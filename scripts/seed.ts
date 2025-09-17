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
      parentName: 'Giuseppe Bianchi',
      parentEmail: 'parent@englishplus.it',
      parentPhone: '+39 333 2222222',
      tenantId: tenant.id,
      status: UserStatus.ACTIVE,
    },
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

  console.log('');
  console.log('🌱 Database seeding completed successfully!');
  console.log('');
  console.log('🔐 All users have password: "password"');
  console.log('');
  console.log('👥 Available login accounts:');
  console.log('📧 Admin: admin@englishplus.it');
  console.log('🏫 Teacher: teacher@englishplus.it');
  console.log('🎓 Student: student@englishplus.it');
  console.log('👨‍👩‍👧‍👦 Parent: parent@englishplus.it');
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
