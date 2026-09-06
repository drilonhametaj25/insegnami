import { NextRequest, NextResponse } from 'next/server';
import { getAuth, isAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { getPublicErrorMessage } from '@/lib/api-middleware';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Generate temporary password
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// GET /api/students/[id] - Get single student
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    const { id } = await params;

    // Only ADMIN, TEACHER, and the student's parent can view student details
    if (!['ADMIN', 'TEACHER', 'PARENT', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build where clause with tenant scoping
    const where: any = { id };
    
    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    const student = await prisma.student.findFirst({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            status: true,
          },
        },
        parentUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            status: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        guardians: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
          orderBy: { isPrimary: 'desc' },
        },
        classes: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
                code: true,
                isActive: true,
                teacher: {
                  select: { id: true, firstName: true, lastName: true },
                },
                course: {
                  select: { id: true, name: true, level: true },
                },
              },
            },
          },
        },
      } as any,
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // SECURITY: il genitore accede solo ai propri figli (tutore primario
    // denormalizzato O riga StudentGuardian)
    if (session.user.role === 'PARENT') {
      const isGuardian =
        (student as any).parentUserId === session.user.id ||
        ((student as any).guardians ?? []).some(
          (g: any) => g.userId === session.user.id
        );
      if (!isGuardian) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Transform response to maintain API compatibility
    const responseStudent = {
      id: student.id,
      studentCode: student.studentCode,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      phone: student.phone,
      dateOfBirth: student.dateOfBirth,
      address: student.address,
      emergencyContact: student.emergencyContact,
      parentName: (student as any).parentUser ? `${(student as any).parentUser.firstName} ${(student as any).parentUser.lastName}` : null,
      parentEmail: (student as any).parentUser?.email || null,
      parentPhone: (student as any).parentUser?.phone || null,
      medicalNotes: student.medicalNotes,
      specialNeeds: student.specialNeeds,
      status: student.status,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
      // Include user relations for advanced forms
      user: (student as any).user,
      parentUser: (student as any).parentUser,
      // Tutori (tabella ponte StudentGuardian)
      guardians: ((student as any).guardians ?? []).map((g: any) => ({
        id: g.id,
        userId: g.userId,
        relationship: g.relationship,
        isPrimary: g.isPrimary,
        user: g.user,
      })),
      // Classi frequentate (StudentClass → Class)
      classes: ((student as any).classes ?? []).map((sc: any) => ({
        id: sc.class.id,
        name: sc.class.name,
        code: sc.class.code,
        isActive: sc.class.isActive,
        enrolledAt: sc.enrolledAt,
        teacher: sc.class.teacher
          ? {
              id: sc.class.teacher.id,
              name: `${sc.class.teacher.firstName} ${sc.class.teacher.lastName}`,
            }
          : null,
        course: sc.class.course,
      })),
    };

    return NextResponse.json({ student: responseStudent });

  } catch (error) {
    console.error('Error fetching student:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/students/[id] - Update student with advanced options
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    const { id } = await params;
    const data = await request.json();

    // Only ADMIN can update students
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build where clause with tenant scoping
    const where: any = { id };
    
    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    // Get existing student with User relations
    const existingStudent = await prisma.student.findFirst({
      where,
      include: {
        user: true,
        parentUser: true,
      } as any,
    });

    if (!existingStudent) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Student data
    const {
      firstName,
      lastName,
      dateOfBirth,
      email,
      phone,
      address,
      emergencyContact,
      medicalNotes,
      specialNeeds,
      status = 'ACTIVE',
      
      // Account management
      createStudentAccount = false,
      studentPassword,
      
      // Parent management
      hasParent = false,
      parentType, // 'new', 'existing', 'search'
      
      // New parent data
      parentFirstName,
      parentLastName,
      parentEmail,
      parentPhone,
      parentPassword,
      
      // Existing parent
      existingParentId,

      // Tutori (sync tabella ponte): [{ userId, relationship?, isPrimary? }]
      guardians,
    } = data;

    const hasGuardiansPayload = Array.isArray(guardians);

    // Anti-bypass limiti piano: la riattivazione di uno studente non attivo
    // conta come nuovo posto occupato (stesso guard di POST e bulk-activate).
    if (
      status === 'ACTIVE' &&
      existingStudent.status !== 'ACTIVE' &&
      session.user.role !== 'SUPERADMIN'
    ) {
      const { getEffectiveLimits } = await import('@/lib/billing/limits');
      const limits = await getEffectiveLimits(existingStudent.tenantId);
      if (limits.maxStudents != null) {
        const currentActive = await prisma.student.count({
          where: { tenantId: existingStudent.tenantId, status: 'ACTIVE' },
        });
        if (currentActive + 1 > limits.maxStudents) {
          return NextResponse.json(
            {
              error: `Limite studenti del piano raggiunto (${limits.maxStudents}): impossibile riattivare lo studente. Effettua l'upgrade del piano o acquista un add-on.`,
              code: 'plan-limit',
              limit: limits.maxStudents,
              current: currentActive,
            },
            { status: 403 }
          );
        }
      }
    }

    // Perform updates in transaction
    const result = await prisma.$transaction(async (tx) => {
      let studentUser = (existingStudent as any).user;
      let parentUser = (existingStudent as any).parentUser;

      // Handle student account
      if (createStudentAccount) {
        if (!email) {
          throw new Error('Email richiesta per account studente');
        }

        if (studentUser) {
          // Update existing student account
          const updateData: any = {
            email,
            firstName,
            lastName,
            phone: phone || null,
          };
          
          // Only update password if provided
          if (studentPassword) {
            updateData.password = await bcrypt.hash(studentPassword, 10);
          }

          studentUser = await tx.user.update({
            where: { id: studentUser.id },
            data: updateData,
          });
        } else {
          // Create new student account
          if (!studentPassword) {
            throw new Error('Password richiesta per nuovo account studente');
          }

          // Check if email is already used
          const existingUser = await tx.user.findUnique({
            where: { email },
          });

          if (existingUser && existingUser.id !== studentUser?.id) {
            throw new Error('Email già utilizzata da un altro utente');
          }

          const hashedStudentPassword = await bcrypt.hash(studentPassword, 10);

          studentUser = await tx.user.create({
            data: {
              email,
              password: hashedStudentPassword,
              firstName,
              lastName,
              phone: phone || null,
              status: 'ACTIVE',
              emailVerified: new Date(),
            } as any,
          });

          // Add to tenant
          await tx.userTenant.create({
            data: {
              userId: studentUser.id,
              tenantId: session.user.tenantId,
              role: 'STUDENT',
              permissions: JSON.stringify({
                classes: { read: true },
                lessons: { read: true },
                attendance: { read: true },
                payments: { read: true },
                notices: { read: true },
              }),
            },
          });

          // Update student record with userId
          await tx.student.update({
            where: { id: existingStudent.id },
            data: { userId: studentUser.id } as any,
          });
        }
      } else if (data.createStudentAccount === false && studentUser) {
        // Remove student account solo su richiesta esplicita (campo presente
        // e false): i form che non gestiscono l'account non devono rimuoverlo
        await tx.userTenant.deleteMany({
          where: {
            userId: studentUser.id,
            tenantId: session.user.tenantId,
            role: 'STUDENT',
          },
        });

        // SECURITY: Use soft-delete instead of hard-delete (BUG-015 fix)
        await tx.user.update({
          where: { id: studentUser.id },
          data: { status: 'INACTIVE' },
        });

        await tx.student.update({
          where: { id: existingStudent.id },
          data: { userId: null } as any,
        });

        studentUser = null;
      }

      // Handle parent account (flusso legacy, saltato se arriva guardians[])
      if (!hasGuardiansPayload && hasParent) {
        if (parentType === 'existing' || parentType === 'search') {
          // Use existing parent
          if (!existingParentId) {
            throw new Error('ID genitore richiesto per genitore esistente');
          }

          // Remove current parent if different
          if (parentUser && parentUser.id !== existingParentId) {
            // Check if current parent has other children
            const otherChildren = await tx.student.findMany({
              where: {
                parentUserId: parentUser.id,
                id: { not: existingStudent.id },
              } as any,
            });

            if (otherChildren.length === 0) {
              // Remove parent account if no other children
              await tx.userTenant.deleteMany({
                where: {
                  userId: parentUser.id,
                  tenantId: session.user.tenantId,
                  role: 'PARENT',
                },
              });
            }
          }

          parentUser = await tx.user.findUnique({
            where: { id: existingParentId },
          });

          if (!parentUser) {
            throw new Error('Genitore non trovato');
          }

          // Ensure parent has PARENT role in this tenant
          const existingUserTenant = await tx.userTenant.findUnique({
            where: {
              userId_tenantId: {
                userId: parentUser.id,
                tenantId: session.user.tenantId,
              },
            },
          });

          if (!existingUserTenant) {
            await tx.userTenant.create({
              data: {
                userId: parentUser.id,
                tenantId: session.user.tenantId,
                role: 'PARENT',
                permissions: JSON.stringify({
                  students: { read: true },
                  attendance: { read: true },
                  payments: { read: true },
                  notices: { read: true },
                }),
              },
            });
          }

          // Update student with new parent
          await tx.student.update({
            where: { id: existingStudent.id },
            data: { parentUserId: parentUser.id } as any,
          });

        } else if (parentType === 'new') {
          // Create new parent
          if (!parentFirstName || !parentLastName || !parentEmail || !parentPassword) {
            throw new Error('Tutti i dati del genitore sono richiesti per nuovo account');
          }

          // Check if email is already used
          const existingParent = await tx.user.findUnique({
            where: { email: parentEmail },
          });

          if (existingParent && existingParent.id !== parentUser?.id) {
            throw new Error('Email genitore già utilizzata da un altro utente');
          }

          if (parentUser) {
            // Update existing parent
            const updateData: any = {
              email: parentEmail,
              firstName: parentFirstName,
              lastName: parentLastName,
              phone: parentPhone || null,
            };
            
            // Only update password if provided
            if (parentPassword) {
              updateData.password = await bcrypt.hash(parentPassword, 10);
            }

            parentUser = await tx.user.update({
              where: { id: parentUser.id },
              data: updateData,
            });
          } else {
            // Create new parent
            const hashedParentPassword = await bcrypt.hash(parentPassword, 10);

            parentUser = await tx.user.create({
              data: {
                email: parentEmail,
                password: hashedParentPassword,
                firstName: parentFirstName,
                lastName: parentLastName,
                phone: parentPhone || null,
                status: 'ACTIVE',
                emailVerified: new Date(),
              } as any,
            });

            // Add to tenant
            await tx.userTenant.create({
              data: {
                userId: parentUser.id,
                tenantId: session.user.tenantId,
                role: 'PARENT',
                permissions: JSON.stringify({
                  students: { read: true },
                  attendance: { read: true },
                  payments: { read: true },
                  notices: { read: true },
                }),
              },
            });

            // Update student with parent
            await tx.student.update({
              where: { id: existingStudent.id },
              data: { parentUserId: parentUser.id } as any,
            });
          }
        }
      } else if (!hasGuardiansPayload && data.hasParent === false && parentUser) {
        // Remove parent connection (solo se il client dichiara esplicitamente
        // hasParent: false — un payload senza campo non deve scollegare nulla)
        // Check if parent has other children
        const otherChildren = await tx.student.findMany({
          where: {
            parentUserId: parentUser.id,
            id: { not: existingStudent.id },
          } as any,
        });

        if (otherChildren.length === 0) {
          // Remove parent account if no other children
          await tx.userTenant.deleteMany({
            where: {
              userId: parentUser.id,
              tenantId: session.user.tenantId,
              role: 'PARENT',
            },
          });

          // SECURITY: Use soft-delete instead of hard-delete (BUG-015 fix)
          await tx.user.update({
            where: { id: parentUser.id },
            data: { status: 'INACTIVE' },
          });
        }

        // Remove parent connection from student
        await tx.student.update({
          where: { id: existingStudent.id },
          data: { parentUserId: null } as any,
        });

        parentUser = null;
      }

      // Sync tabella ponte StudentGuardian (fonte di verità dei tutori).
      // parentUserId resta come denormalizzazione del tutore primario.
      if (hasGuardiansPayload) {
        const wanted: Array<{ userId: string; relationship?: string | null; isPrimary?: boolean }> =
          (guardians as any[])
            .filter((g) => g && typeof g.userId === 'string' && g.userId.length > 0)
            // dedup per userId (l'ultimo vince)
            .reduce((acc: any[], g) => {
              const idx = acc.findIndex((x) => x.userId === g.userId);
              if (idx >= 0) acc[idx] = g;
              else acc.push(g);
              return acc;
            }, []);

        if (wanted.length > 0) {
          // I tutori devono essere utenti del tenant dello studente
          const validUsers = await tx.user.findMany({
            where: {
              id: { in: wanted.map((g) => g.userId) },
              tenants: { some: { tenantId: existingStudent.tenantId } },
            },
            select: { id: true },
          });
          if (validUsers.length !== wanted.length) {
            throw new Error('Uno o più tutori non appartengono a questa scuola');
          }
        }

        await tx.studentGuardian.deleteMany({
          where: {
            studentId: existingStudent.id,
            userId: { notIn: wanted.map((g) => g.userId) },
          },
        });

        for (const g of wanted) {
          await tx.studentGuardian.upsert({
            where: {
              studentId_userId: {
                studentId: existingStudent.id,
                userId: g.userId,
              },
            },
            update: {
              relationship: g.relationship ?? null,
              isPrimary: Boolean(g.isPrimary),
            },
            create: {
              tenantId: existingStudent.tenantId,
              studentId: existingStudent.id,
              userId: g.userId,
              relationship: g.relationship ?? null,
              isPrimary: Boolean(g.isPrimary),
            },
          });
        }

        const primary = wanted.find((g) => g.isPrimary) ?? wanted[0] ?? null;
        await tx.student.update({
          where: { id: existingStudent.id },
          data: { parentUserId: primary ? primary.userId : null },
        });
      }

      // Update student record
      const updatedStudent = await tx.student.update({
        where: { id: existingStudent.id },
        data: {
          firstName,
          lastName,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : existingStudent.dateOfBirth,
          email,
          phone,
          address,
          emergencyContact,
          medicalNotes,
          specialNeeds,
          status,
        } as any,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          parentUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          guardians: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                },
              },
            },
            orderBy: { isPrimary: 'desc' },
          },
        } as any,
      });

      return updatedStudent;
    });

    return NextResponse.json({
      success: true,
      student: {
        ...(result as any),
        // For backward compatibility in the UI
        parentName: (result as any).parentUser ? `${(result as any).parentUser.firstName} ${(result as any).parentUser.lastName}` : null,
        parentEmail: (result as any).parentUser?.email || null,
        parentPhone: (result as any).parentUser?.phone || null,
      },
    });

  } catch (error) {
    // BUG-050 fix: Use generic error message to prevent info disclosure
    return NextResponse.json(
      { error: getPublicErrorMessage(error, 'Errore durante l\'aggiornamento dello studente') },
      { status: 500 }
    );
  }
}

// DELETE /api/students/[id] - Delete student
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    const { id } = await params;

    // Only ADMIN can delete students
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build where clause with tenant scoping
    const where: any = { id };
    
    if (session.user.role !== 'SUPERADMIN') {
      where.tenantId = session.user.tenantId;
    }

    // Get student with User relations
    const student = await prisma.student.findFirst({
      where,
      include: {
        user: true,
        parentUser: true,
      } as any,
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // BUG-047 fix: Create audit log before deletion
      await tx.auditLog.create({
        data: {
          tenantId: session.user.tenantId,
          userId: session.user.id || 'unknown',
          action: 'DELETE',
          entity: 'Student',
          entityId: student.id,
          oldData: {
            id: student.id,
            firstName: student.firstName,
            lastName: student.lastName,
            studentCode: student.studentCode,
          } as any,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      });

      // Delete student record first
      await tx.student.delete({
        where: { id },
      });

      // Clean up associated User account if exists
      if ((student as any).userId) {
        await tx.userTenant.deleteMany({
          where: {
            userId: (student as any).userId,
            tenantId: session.user.tenantId,
            role: 'STUDENT',
          },
        });

        // SECURITY: Use soft-delete instead of hard-delete (BUG-015 fix)
        await tx.user.update({
          where: { id: (student as any).userId },
          data: { status: 'INACTIVE' },
        });
      }

      // Clean up parent User account if no other children
      if ((student as any).parentUserId) {
        const otherChildren = await tx.student.findMany({
          where: {
            parentUserId: (student as any).parentUserId,
            id: { not: id },
          } as any,
        });

        if (otherChildren.length === 0) {
          await tx.userTenant.deleteMany({
            where: {
              userId: (student as any).parentUserId,
              tenantId: session.user.tenantId,
              role: 'PARENT',
            },
          });

          // SECURITY: Use soft-delete instead of hard-delete (BUG-015 fix)
          await tx.user.update({
            where: { id: (student as any).parentUserId },
            data: { status: 'INACTIVE' },
          });
        }
      }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting student:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}