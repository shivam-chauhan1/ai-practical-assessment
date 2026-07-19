import { PrismaClient, Role, Status, Priority } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ─── Users (5) ───────────────────────────────────────────────────────────────
  const users = [
    { id: 'a1b2c3d4-0001-4000-8000-000000000001', name: 'Alice Admin', email: 'alice@example.com', role: Role.ADMIN },
    { id: 'a1b2c3d4-0002-4000-8000-000000000002', name: 'Bob Agent', email: 'bob@example.com', role: Role.AGENT },
    { id: 'a1b2c3d4-0003-4000-8000-000000000003', name: 'Carol Agent', email: 'carol@example.com', role: Role.AGENT },
    { id: 'a1b2c3d4-0004-4000-8000-000000000004', name: 'Dave Admin', email: 'dave@example.com', role: Role.ADMIN },
    { id: 'a1b2c3d4-0005-4000-8000-000000000005', name: 'Eve Agent', email: 'eve@example.com', role: Role.AGENT },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: user,
    });
  }

  console.log(`Seeded ${users.length} users`);

  // ─── Tickets (12) — covers all 5 statuses ───────────────────────────────────
  const tickets = [
    {
      id: 'b1b2c3d4-0001-4000-8000-000000000001',
      title: 'Login page returns 500 error',
      description: 'Users report intermittent 500 errors when accessing the login page during peak hours.',
      status: Status.OPEN,
      priority: Priority.HIGH,
      createdBy: users[0].id,
      assignedTo: null,
    },
    {
      id: 'b1b2c3d4-0002-4000-8000-000000000002',
      title: 'Update user profile endpoint',
      description: 'Need to add phone number field to the user profile update API.',
      status: Status.OPEN,
      priority: Priority.MEDIUM,
      createdBy: users[1].id,
      assignedTo: users[2].id,
    },
    {
      id: 'b1b2c3d4-0003-4000-8000-000000000003',
      title: 'Database connection pool exhaustion',
      description: 'Under heavy load the connection pool runs out of connections causing timeouts.',
      status: Status.IN_PROGRESS,
      priority: Priority.URGENT,
      createdBy: users[0].id,
      assignedTo: users[1].id,
    },
    {
      id: 'b1b2c3d4-0004-4000-8000-000000000004',
      title: 'Add CSV export for reports',
      description: 'Stakeholders want to export monthly ticket reports as CSV files.',
      status: Status.IN_PROGRESS,
      priority: Priority.MEDIUM,
      createdBy: users[2].id,
      assignedTo: users[4].id,
    },
    {
      id: 'b1b2c3d4-0005-4000-8000-000000000005',
      title: 'Fix email notification formatting',
      description: 'HTML emails are rendering incorrectly in Outlook clients.',
      status: Status.RESOLVED,
      priority: Priority.LOW,
      createdBy: users[3].id,
      assignedTo: users[1].id,
    },
    {
      id: 'b1b2c3d4-0006-4000-8000-000000000006',
      title: 'Implement password reset flow',
      description: 'Users need a self-service password reset using email verification.',
      status: Status.RESOLVED,
      priority: Priority.HIGH,
      createdBy: users[0].id,
      assignedTo: users[2].id,
    },
    {
      id: 'b1b2c3d4-0007-4000-8000-000000000007',
      title: 'Upgrade Node.js to v20',
      description: 'Current Node.js 18 is approaching EOL. Plan and execute upgrade to v20 LTS.',
      status: Status.CLOSED,
      priority: Priority.MEDIUM,
      createdBy: users[1].id,
      assignedTo: users[0].id,
    },
    {
      id: 'b1b2c3d4-0008-4000-8000-000000000008',
      title: 'Refactor legacy auth middleware',
      description: 'The old authentication middleware has grown too complex and needs refactoring.',
      status: Status.CLOSED,
      priority: Priority.LOW,
      createdBy: users[3].id,
      assignedTo: users[4].id,
    },
    {
      id: 'b1b2c3d4-0009-4000-8000-000000000009',
      title: 'Add dark mode to dashboard',
      description: 'Feature request: support dark mode theme for the admin dashboard.',
      status: Status.CANCELLED,
      priority: Priority.LOW,
      createdBy: users[4].id,
      assignedTo: null,
    },
    {
      id: 'b1b2c3d4-0010-4000-8000-000000000010',
      title: 'Integrate third-party analytics',
      description: 'Cancelled: decided to build in-house analytics instead of using a third-party tool.',
      status: Status.CANCELLED,
      priority: Priority.MEDIUM,
      createdBy: users[2].id,
      assignedTo: users[3].id,
    },
    {
      id: 'b1b2c3d4-0011-4000-8000-000000000011',
      title: 'API rate limiting implementation',
      description: 'Add rate limiting middleware to prevent API abuse from automated clients.',
      status: Status.OPEN,
      priority: Priority.URGENT,
      createdBy: users[3].id,
      assignedTo: users[1].id,
    },
    {
      id: 'b1b2c3d4-0012-4000-8000-000000000012',
      title: 'Fix pagination off-by-one error',
      description: 'The ticket list pagination shows duplicate items on page boundaries.',
      status: Status.IN_PROGRESS,
      priority: Priority.HIGH,
      createdBy: users[4].id,
      assignedTo: users[2].id,
    },
  ];

  for (const ticket of tickets) {
    await prisma.ticket.upsert({
      where: { id: ticket.id },
      update: {},
      create: ticket,
    });
  }

  console.log(`Seeded ${tickets.length} tickets`);

  // ─── Comments (8) — scattered across tickets, including one on CLOSED ticket ─
  const comments = [
    {
      id: 'c1b2c3d4-0001-4000-8000-000000000001',
      body: 'I can reproduce this consistently at around 9 AM when traffic spikes.',
      ticketId: tickets[0].id,
      authorId: users[1].id,
    },
    {
      id: 'c1b2c3d4-0002-4000-8000-000000000002',
      body: 'Increased the connection pool size to 50. Monitoring for the next 24 hours.',
      ticketId: tickets[2].id,
      authorId: users[1].id,
    },
    {
      id: 'c1b2c3d4-0003-4000-8000-000000000003',
      body: 'Pool size increase resolved the immediate issue but we should investigate the root cause.',
      ticketId: tickets[2].id,
      authorId: users[0].id,
    },
    {
      id: 'c1b2c3d4-0004-4000-8000-000000000004',
      body: 'CSV export feature spec has been approved by stakeholders.',
      ticketId: tickets[3].id,
      authorId: users[2].id,
    },
    {
      id: 'c1b2c3d4-0005-4000-8000-000000000005',
      body: 'Tested the fix in Outlook 2019 and 365 — looks good now.',
      ticketId: tickets[4].id,
      authorId: users[3].id,
    },
    {
      id: 'c1b2c3d4-0006-4000-8000-000000000006',
      body: 'Node 20 upgrade completed successfully. All CI pipelines passing.',
      ticketId: tickets[6].id, // CLOSED ticket
      authorId: users[1].id,
    },
    {
      id: 'c1b2c3d4-0007-4000-8000-000000000007',
      body: 'Closing this out — the refactor was merged in PR #247.',
      ticketId: tickets[7].id, // CLOSED ticket
      authorId: users[4].id,
    },
    {
      id: 'c1b2c3d4-0008-4000-8000-000000000008',
      body: 'Rate limiting should use a sliding window approach for better fairness.',
      ticketId: tickets[10].id,
      authorId: users[0].id,
    },
  ];

  for (const comment of comments) {
    await prisma.comment.upsert({
      where: { id: comment.id },
      update: {},
      create: comment,
    });
  }

  console.log(`Seeded ${comments.length} comments`);

  // ─── Tags (5) ────────────────────────────────────────────────────────────────
  const tagNames = ['Bug', 'Feature Request', 'Performance', 'Documentation', 'Security'];

  for (const name of tagNames) {
    await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log(`Seeded ${tagNames.length} tags`);

  // ─── Tag-Ticket Associations ─────────────────────────────────────────────────
  const tagAssociations: { ticketId: string; tagNames: string[] }[] = [
    { ticketId: tickets[0].id, tagNames: ['Bug', 'Performance'] },       // Login page 500 error → 2 tags
    { ticketId: tickets[2].id, tagNames: ['Performance'] },              // DB connection pool
    { ticketId: tickets[3].id, tagNames: ['Feature Request'] },          // CSV export
    { ticketId: tickets[10].id, tagNames: ['Security', 'Performance'] }, // API rate limiting → 2 tags
  ];

  let associationCount = 0;
  for (const assoc of tagAssociations) {
    await prisma.ticket.update({
      where: { id: assoc.ticketId },
      data: {
        tags: {
          connect: assoc.tagNames.map((name) => ({ name })),
        },
      },
    });
    associationCount += assoc.tagNames.length;
  }

  console.log(`Established ${associationCount} tag-ticket associations`);
  console.log('Seed complete!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
