import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

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
      } as any,
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
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

    const { id } = await params;
    const data = await request.json();

    // Only ADMIN can update students
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
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
    } = data;

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
      } else if (studentUser) {
        // Remove student account if unchecked
        await tx.userTenant.deleteMany({
          where: {
            userId: studentUser.id,
            tenantId: session.user.tenantId,
            role: 'STUDENT',
          },
        });

        await tx.user.delete({
          where: { id: studentUser.id },
        });

        await tx.student.update({
          where: { id: existingStudent.id },
          data: { userId: null } as any,
        });

        studentUser = null;
      }

      // Handle parent account
      if (hasParent) {
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
      } else if (parentUser) {
        // Remove parent connection
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

          await tx.user.delete({
            where: { id: parentUser.id },
          });
        }

        // Remove parent connection from student
        await tx.student.update({
          where: { id: existingStudent.id },
          data: { parentUserId: null } as any,
        });

        parentUser = null;
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
    console.error('Error updating student:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
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

    const { id } = await params;

    // Only ADMIN can delete students
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
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

        await tx.user.delete({
          where: { id: (student as any).userId },
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

          await tx.user.delete({
            where: { id: (student as any).parentUserId },
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