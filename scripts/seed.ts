import { PrismaClient, Role, UserStatus, NoticeType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create default tenant (for self-hosted mode)
  const tenant = await prisma.tenant.upsert({
    where: { id: '1' },
    update: {},
    create: {
      id: '1',
      name: 'Scuola di Inglese "English Plus"',
      slug: 'english-plus',
      plan: 'self-hosted',
      isActive: true,
      featureFlags: JSON.stringify({
        attendance: true,
        payments: true,
        communications: true,
        calendar: true,
        reports: true,
        parentPortal: true,
      }),
    },
  });

  console.log('✅ Created default tenant');

  // Hash the password "password" once for all users
  const hashedPassword = await bcrypt.hash('password', 12);

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@englishplus.it' },
    update: {},
    create: {
      email: 'admin@englishplus.it',
      password: hashedPassword,
      firstName: 'Mario',
      lastName: 'Rossi',
      phone: '+39 331 1234567',
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
    },
  });

  // Assign admin role to tenant
  await prisma.userTenant.upsert({
    where: {
      userId_tenantId: {
        userId: adminUser.id,
        tenantId: tenant.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      tenantId: tenant.id,
      role: Role.ADMIN,
      permissions: JSON.stringify({
        users: { create: true, read: true, update: true, delete: true },
        students: { create: true, read: true, update: true, delete: true },
        teachers: { create: true, read: true, update: true, delete: true },
        classes: { create: true, read: true, update: true, delete: true },
        lessons: { create: true, read: true, update: true, delete: true },
        attendance: { create: true, read: true, update: true, delete: true },
        payments: { create: true, read: true, update: true, delete: true },
        notices: { create: true, read: true, update: true, delete: true },
        reports: { create: true, read: true, update: true, delete: true },
      }),
    },
  });

  console.log('✅ Created admin user: admin@englishplus.it / password');

  // Create teacher user
  const teacherUser = await prisma.user.upsert({
    where: { email: 'teacher@englishplus.it' },
    update: {},
    create: {
      email: 'teacher@englishplus.it',
      password: hashedPassword,
      firstName: 'Anna',
      lastName: 'Smith',
      phone: '+39 331 2345678',
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
    },
  });

  // Assign teacher role
  await prisma.userTenant.upsert({
    where: {
      userId_tenantId: {
        userId: teacherUser.id,
        tenantId: tenant.id,
      },
    },
    update: {},
    create: {
      userId: teacherUser.id,
      tenantId: tenant.id,
      role: Role.TEACHER,
      permissions: JSON.stringify({
        students: { read: true },
        classes: { read: true },
        lessons: { read: true, update: true },
        attendance: { create: true, read: true, update: true },
        notices: { read: true },
      }),
    },
  });

  // Create teacher record
  const teacher = await prisma.teacher.create({
    data: {
      firstName: 'Anna',
      lastName: 'Smith',
      email: 'teacher@englishplus.it',
      phone: '+39 331 2345678',
      teacherCode: 'T001',
      qualifications: 'TEFL Certificate, BA in English Literature',
      specializations: 'Business English, IELTS Preparation',
      contractType: 'Full-time',
      hourlyRate: 35.00,
      tenantId: tenant.id,
      status: UserStatus.ACTIVE,
    },
  });

  console.log('✅ Created teacher user: teacher@englishplus.it / password');

  // Create student user
  const studentUser = await prisma.user.upsert({
    where: { email: 'student@englishplus.it' },
    update: {},
    create: {
      email: 'student@englishplus.it',
      password: hashedPassword,
      firstName: 'Marco',
      lastName: 'Bianchi',
      phone: '+39 333 1111111',
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
    },
  });

  // Assign student role
  await prisma.userTenant.upsert({
    where: {
      userId_tenantId: {
        userId: studentUser.id,
        tenantId: tenant.id,
      },
    },
    update: {},
    create: {
      userId: studentUser.id,
      tenantId: tenant.id,
      role: Role.STUDENT,
      permissions: JSON.stringify({
        classes: { read: true },
        lessons: { read: true },
        attendance: { read: true },
        payments: { read: true },
        notices: { read: true },
      }),
    },
  });

  // Create parent user
  const parentUser = await prisma.user.upsert({
    where: { email: 'parent@englishplus.it' },
    update: {},
    create: {
      email: 'parent@englishplus.it',
      password: hashedPassword,
      firstName: 'Giuseppe',
      lastName: 'Bianchi',
      phone: '+39 333 2222222',
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
    },
  });

  // Assign parent role
  await prisma.userTenant.upsert({
    where: {
      userId_tenantId: {
        userId: parentUser.id,
        tenantId: tenant.id,
      },
    },
    update: {},
    create: {
      userId: parentUser.id,
      tenantId: tenant.id,
      role: Role.PARENT,
      permissions: JSON.stringify({
        students: { read: true },
        classes: { read: true },
        lessons: { read: true },
        attendance: { read: true },
        payments: { read: true },
        notices: { read: true },
      }),
    },
  });

  console.log('✅ Created student user: student@englishplus.it / password');
  console.log('✅ Created parent user: parent@englishplus.it / password');

  // Create course
  const course = await prisma.course.create({
    data: {
      name: 'General English - Beginner',
      code: 'GE-BEG',
      description: 'Foundation course for absolute beginners',
      category: 'General English',
      level: 'Beginner',
      duration: 60, // hours
      maxStudents: 12,
      minStudents: 4,
      price: 450.00,
      tenantId: tenant.id,
      isActive: true,
    },
  });

  console.log('✅ Created course');

  // Create student record
  const student = await prisma.student.create({
    data: {
      firstName: 'Marco',
      lastName: 'Bianchi',
      email: 'student@englishplus.it',
      phone: '+39 333 1111111',
      dateOfBirth: new Date('1990-05-15'),
      studentCode: 'S001',
      address: 'Via Roma 123, Milano',
      tenantId: tenant.id,
      status: UserStatus.ACTIVE,
      userId: studentUser.id,
      parentUserId: parentUser.id,
    } as any,
  });

  console.log('✅ Created student record');

  // Create class
  const classRecord = await prisma.class.create({
    data: {
      name: 'Beginner Morning Class',
      code: 'BMC-2024-01',
      courseId: course.id,
      teacherId: teacher.id,
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-04-15'),
      maxStudents: 12,
      tenantId: tenant.id,
      isActive: true,
    },
  });

  // Enroll student in class
  await prisma.studentClass.create({
    data: {
      studentId: student.id,
      classId: classRecord.id,
      isActive: true,
    },
  });

  console.log('✅ Created class and enrolled student');

  // Create sample notices
  await prisma.notice.create({
    data: {
      title: 'Welcome to English Plus!',
      content: 'We are excited to welcome all new students to our English language school. Classes start next week!',
      type: NoticeType.ANNOUNCEMENT,
      isPublic: true,
      targetRoles: [Role.STUDENT, Role.TEACHER, Role.ADMIN],
      isPinned: true,
      tenantId: tenant.id,
    },
  });

  await prisma.notice.create({
    data: {
      title: 'Holiday Schedule',
      content: 'Please note that the school will be closed from December 23rd to January 7th for the holiday break.',
      type: NoticeType.REMINDER,
      isPublic: true,
      targetRoles: [Role.STUDENT, Role.TEACHER, Role.ADMIN],
      tenantId: tenant.id,
    },
  });

  console.log('✅ Created sample notices');

  // Create more teachers and students for realistic data
  const teacher2User = await prisma.user.upsert({
    where: { email: 'teacher2@englishplus.it' },
    update: {},
    create: {
      email: 'teacher2@englishplus.it',
      password: hashedPassword,
      firstName: 'James',
      lastName: 'Wilson',
      phone: '+39 331 3456789',
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
    },
  });

  await prisma.userTenant.upsert({
    where: {
      userId_tenantId: {
        userId: teacher2User.id,
        tenantId: tenant.id,
      },
    },
    update: {},
    create: {
      userId: teacher2User.id,
      tenantId: tenant.id,
      role: Role.TEACHER,
      permissions: JSON.stringify({
        students: { read: true },
        classes: { read: true },
        lessons: { read: true, update: true },
        attendance: { create: true, read: true, update: true },
        notices: { read: true },
      }),
    },
  });

  const teacher2 = await prisma.teacher.create({
    data: {
      firstName: 'James',
      lastName: 'Wilson',
      email: 'teacher2@englishplus.it',
      phone: '+39 331 3456789',
      teacherCode: 'T002',
      qualifications: 'CELTA Certificate, MA in Applied Linguistics',
      specializations: 'TOEFL Preparation, Conversation Classes',
      contractType: 'Part-time',
      hourlyRate: 30.00,
      tenantId: tenant.id,
      status: UserStatus.ACTIVE,
    },
  });

  // Create more courses
  const course2 = await prisma.course.create({
    data: {
      name: 'General English - Intermediate',
      code: 'GE-INT',
      description: 'Intermediate level course for students with basic knowledge',
      category: 'General English',
      level: 'Intermediate',
      duration: 80,
      maxStudents: 10,
      minStudents: 6,
      price: 520.00,
      tenantId: tenant.id,
      isActive: true,
    },
  });

  const course3 = await prisma.course.create({
    data: {
      name: 'Business English - Advanced',
      code: 'BE-ADV',
      description: 'Advanced business English for professionals',
      category: 'Business English',
      level: 'Advanced',
      duration: 60,
      maxStudents: 8,
      minStudents: 4,
      price: 680.00,
      tenantId: tenant.id,
      isActive: true,
    },
  });

  // Create more students
  const students = [];
  const studentData = [
    { firstName: 'Giulia', lastName: 'Romano', email: 'giulia.romano@email.it', parentFirstName: 'Roberto', parentLastName: 'Romano', parentEmail: 'roberto.romano@email.it' },
    { firstName: 'Luca', lastName: 'Ferrari', email: 'luca.ferrari@email.it', parentFirstName: 'Maria', parentLastName: 'Ferrari', parentEmail: 'maria.ferrari@email.it' },
    { firstName: 'Chiara', lastName: 'Esposito', email: 'chiara.esposito@email.it', parentFirstName: 'Antonio', parentLastName: 'Esposito', parentEmail: 'antonio.esposito@email.it' },
    { firstName: 'Andrea', lastName: 'Conti', email: 'andrea.conti@email.it', parentFirstName: 'Francesca', parentLastName: 'Conti', parentEmail: 'francesca.conti@email.it' },
    { firstName: 'Sofia', lastName: 'Ricci', email: 'sofia.ricci@email.it', parentFirstName: 'Marco', parentLastName: 'Ricci', parentEmail: 'marco.ricci@email.it' },
  ];

  for (let i = 0; i < studentData.length; i++) {
    const studentInfo = studentData[i];
    
    // Create user for student
    const studentUser = await prisma.user.create({
      data: {
        email: studentInfo.email,
        password: hashedPassword,
        firstName: studentInfo.firstName,
        lastName: studentInfo.lastName,
        phone: `+39 333 ${(1000000 + i).toString()}`,
        status: UserStatus.ACTIVE,
        emailVerified: new Date(),
      },
    });

    await prisma.userTenant.create({
      data: {
        userId: studentUser.id,
        tenantId: tenant.id,
        role: Role.STUDENT,
        permissions: JSON.stringify({
          classes: { read: true },
          lessons: { read: true },
          attendance: { read: true },
          payments: { read: true },
          notices: { read: true },
        }),
      },
    });

    // Create parent user
    const parentUser = await prisma.user.create({
      data: {
        email: studentInfo.parentEmail,
        password: hashedPassword,
        firstName: studentInfo.parentFirstName,
        lastName: studentInfo.parentLastName,
        phone: `+39 334 ${(1000000 + i).toString()}`,
        status: UserStatus.ACTIVE,
        emailVerified: new Date(),
      },
    });

    await prisma.userTenant.create({
      data: {
        userId: parentUser.id,
        tenantId: tenant.id,
        role: Role.PARENT,
        permissions: JSON.stringify({
          students: { read: true },
          classes: { read: true },
          lessons: { read: true },
          attendance: { read: true },
          payments: { read: true },
          notices: { read: true },
        }),
      },
    });

    // Create student record
    const studentRecord = await prisma.student.create({
      data: {
        firstName: studentInfo.firstName,
        lastName: studentInfo.lastName,
        email: studentInfo.email,
        phone: `+39 333 ${(1000000 + i).toString()}`,
        dateOfBirth: new Date(`199${2 + i}-0${(i % 9) + 1}-${10 + i}`),
        studentCode: `S${(i + 2).toString().padStart(3, '0')}`,
        address: `Via ${['Roma', 'Milano', 'Napoli', 'Torino', 'Palermo'][i]} ${123 + i * 10}, Milano`,
        tenantId: tenant.id,
        status: UserStatus.ACTIVE,
        userId: studentUser.id,
        parentUserId: parentUser.id,
      } as any,
    });

    students.push(studentRecord);
  }

  // Create more classes
  const class2 = await prisma.class.create({
    data: {
      name: 'Intermediate Evening Class',
      code: 'IEC-2024-01',
      courseId: course2.id,
      teacherId: teacher2.id,
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-05-30'),
      maxStudents: 10,
      tenantId: tenant.id,
      isActive: true,
    },
  });

  const class3 = await prisma.class.create({
    data: {
      name: 'Business Advanced Weekend',
      code: 'BAW-2024-01',
      courseId: course3.id,
      teacherId: teacher.id,
      startDate: new Date('2024-01-20'),
      endDate: new Date('2024-04-20'),
      maxStudents: 8,
      tenantId: tenant.id,
      isActive: true,
    },
  });

  // Enroll students in different classes
  await prisma.studentClass.create({
    data: { studentId: students[0].id, classId: classRecord.id, isActive: true },
  });
  await prisma.studentClass.create({
    data: { studentId: students[1].id, classId: classRecord.id, isActive: true },
  });
  await prisma.studentClass.create({
    data: { studentId: students[2].id, classId: class2.id, isActive: true },
  });
  await prisma.studentClass.create({
    data: { studentId: students[3].id, classId: class2.id, isActive: true },
  });
  await prisma.studentClass.create({
    data: { studentId: students[4].id, classId: class3.id, isActive: true },
  });

  // Create sample lessons for the coming weeks
  const now = new Date();
  const lessons = [];
  
  // Create lessons for the first class (3 times a week: Mon, Wed, Fri at 9:00)
  for (let week = 0; week < 4; week++) {
    for (let day of [1, 3, 5]) { // Monday, Wednesday, Friday
      const lessonDate = new Date(now);
      lessonDate.setDate(now.getDate() + (week * 7) + day);
      lessonDate.setHours(9, 0, 0, 0);
      
      const lesson = await prisma.lesson.create({
        data: {
          title: `General English - Beginner (Week ${week + 1})`,
          startTime: lessonDate,
          endTime: new Date(lessonDate.getTime() + 90 * 60000), // 90 minutes later
          room: 'Room A1',
          classId: classRecord.id,
          teacherId: teacher.id,
          tenantId: tenant.id,
          status: week < 2 ? 'COMPLETED' : 'SCHEDULED',
        },
      });
      lessons.push({ lesson, students: [student, students[0], students[1]] });
    }
  }

  // Create lessons for the second class (2 times a week: Tue, Thu at 18:30)
  for (let week = 0; week < 4; week++) {
    for (let day of [2, 4]) { // Tuesday, Thursday
      const lessonDate = new Date(now);
      lessonDate.setDate(now.getDate() + (week * 7) + day);
      lessonDate.setHours(18, 30, 0, 0);
      
      const lesson = await prisma.lesson.create({
        data: {
          title: `Intermediate English (Week ${week + 1})`,
          startTime: lessonDate,
          endTime: new Date(lessonDate.getTime() + 90 * 60000), // 90 minutes later
          room: 'Room B2',
          classId: class2.id,
          teacherId: teacher2.id,
          tenantId: tenant.id,
          status: week < 2 ? 'COMPLETED' : 'SCHEDULED',
        },
      });
      lessons.push({ lesson, students: [students[2], students[3]] });
    }
  }

  // Create attendance records for completed lessons
  for (const { lesson, students: lessonStudents } of lessons) {
    if (lesson.status === 'COMPLETED') {
      for (const student of lessonStudents) {
        await prisma.attendance.create({
          data: {
            studentId: student.id,
            lessonId: lesson.id,
            status: Math.random() > 0.1 ? 'PRESENT' : 'ABSENT', // 90% attendance rate
            notes: Math.random() > 0.8 ? 'Great participation!' : undefined,
          },
        });
      }
    }
  }

  // Create payment records
  const allStudents = [student, ...students];
  for (const studentRecord of allStudents) {
    // Create a payment for each student
    await prisma.payment.create({
      data: {
        studentId: studentRecord.id,
        amount: 450.00,
        description: 'Course fee - General English Beginner',
        dueDate: new Date('2024-01-10'),
        status: Math.random() > 0.3 ? 'PAID' : 'PENDING',
        paidDate: Math.random() > 0.3 ? new Date('2024-01-08') : undefined,
        paymentMethod: 'BANK_TRANSFER',
        tenantId: tenant.id,
      },
    });

    // Some students have additional payments
    if (Math.random() > 0.5) {
      await prisma.payment.create({
        data: {
          studentId: studentRecord.id,
          amount: 50.00,
          description: 'Registration fee',
          dueDate: new Date('2024-01-01'),
          status: 'PAID',
          paidDate: new Date('2023-12-28'),
          paymentMethod: 'CASH',
          tenantId: tenant.id,
        },
      });
    }
  }

  // Create more notices
  await prisma.notice.create({
    data: {
      title: 'New Business English Course Available!',
      content: 'We are pleased to announce a new Business English course starting next month. Perfect for professionals looking to improve their business communication skills.',
      type: NoticeType.ANNOUNCEMENT,
      isPublic: true,
      targetRoles: [Role.STUDENT, Role.PARENT],
      tenantId: tenant.id,
    },
  });

  await prisma.notice.create({
    data: {
      title: 'Reminder: Payment Due',
      content: 'This is a friendly reminder that course payments are due by the 10th of each month. Please ensure your payments are up to date.',
      type: NoticeType.REMINDER,
      isPublic: true,
      targetRoles: [Role.STUDENT, Role.PARENT],
      tenantId: tenant.id,
    },
  });

  await prisma.notice.create({
    data: {
      title: 'Staff Meeting - Teachers Only',
      content: 'Monthly staff meeting scheduled for next Friday at 15:00. Please prepare your monthly reports.',
      type: NoticeType.REMINDER,
      isPublic: false,
      targetRoles: [Role.TEACHER, Role.ADMIN],
      tenantId: tenant.id,
    },
  });

  console.log('✅ Created additional teachers, students, classes, and lessons');
  console.log('✅ Created attendance records for completed lessons');
  console.log('✅ Created payment records with realistic status distribution');
  console.log('✅ Created additional notices for different user types');

  console.log('');
  console.log('🌱 Database seeding completed successfully!');
  console.log('');
  console.log('🔐 All users have password: "password"');
  console.log('');
  console.log('👥 Available login accounts:');
  console.log('📧 Admin: admin@englishplus.it');
  console.log('🏫 Teacher: teacher@englishplus.it, teacher2@englishplus.it');
  console.log('🎓 Student: student@englishplus.it, giulia.romano@email.it, luca.ferrari@email.it, chiara.esposito@email.it, andrea.conti@email.it, sofia.ricci@email.it');
  console.log('👨‍👩‍👧‍👦 Parent: parent@englishplus.it, + 5 additional parent accounts');
  console.log('');
  console.log('📊 Sample data includes:');
  console.log('  - 3 courses (Beginner, Intermediate, Advanced Business)');
  console.log('  - 3 active classes with enrolled students');
  console.log('  - Multiple lessons with attendance tracking');
  console.log('  - Payment records with various statuses');
  console.log('  - Notices for different user roles');
  console.log('');
  console.log('🌐 You can now start the application and log in with any of these accounts.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Error during seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
