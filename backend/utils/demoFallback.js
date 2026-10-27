/**
 * Presentation Safety Net — Offline & Cloud-Deploy Demo Data Fallback
 * Provides complete, realistic seed data if Neo4j is offline or during cold-start.
 */

export const fallbackCompanies = [
  {
    id: 'comp_google',
    name: 'Google',
    alumniCount: 2,
    companyProperties: { industry: 'Technology & Cloud', location: 'Mountain View, CA / Bangalore' },
    departments: ['CSE'],
    alumni: [
      { id: 'alumni_arun', name: 'Arun Kumar', department: 'CSE', graduationYear: 2022 },
      { id: 'alumni_vikram', name: 'Vikram Seth', department: 'CSE', graduationYear: 2020 },
    ],
    interestedStudents: ['Rahul Verma'],
  },
  {
    id: 'comp_microsoft',
    name: 'Microsoft',
    alumniCount: 2,
    companyProperties: { industry: 'Enterprise Software & AI', location: 'Redmond, WA / Hyderabad' },
    departments: ['CSE'],
    alumni: [
      { id: 'alumni_priya', name: 'Priya Sharma', department: 'CSE', graduationYear: 2023 },
      { id: 'alumni_neha', name: 'Neha Patel', department: 'CSE', graduationYear: 2021 },
    ],
    interestedStudents: ['Rahul Verma'],
  },
  {
    id: 'comp_amazon',
    name: 'Amazon',
    alumniCount: 2,
    companyProperties: { industry: 'E-Commerce & AWS', location: 'Seattle, WA / Chennai' },
    departments: ['IT'],
    alumni: [
      { id: 'alumni_ananya', name: 'Ananya Iyer', department: 'IT', graduationYear: 2022 },
      { id: 'alumni_rohan', name: 'Rohan Gupta', department: 'IT', graduationYear: 2023 },
    ],
    interestedStudents: [],
  },
  {
    id: 'comp_apple',
    name: 'Apple',
    alumniCount: 1,
    companyProperties: { industry: 'Consumer Electronics & OS', location: 'Cupertino, CA' },
    departments: ['ECE'],
    alumni: [
      { id: 'alumni_karthik', name: 'Karthik Raja', department: 'ECE', graduationYear: 2021 },
    ],
    interestedStudents: [],
  },
];

export const fallbackAlumni = [
  {
    id: 'alumni_arun',
    name: 'Arun Kumar',
    company: 'Google',
    department: 'CSE',
    graduationYear: 2022,
    properties: {
      name: 'Arun Kumar',
      department: 'CSE',
      graduationYear: 2022,
      company: 'Google',
      role: 'Staff Software Engineer',
      skills: ['Distributed Systems', 'Go', 'Kubernetes', 'Graph DB'],
      bio: 'Alumnus from 2022 batch, passionate about distributed graph processing and backend scale.',
    },
  },
  {
    id: 'alumni_priya',
    name: 'Priya Sharma',
    company: 'Microsoft',
    department: 'CSE',
    graduationYear: 2023,
    properties: {
      name: 'Priya Sharma',
      department: 'CSE',
      graduationYear: 2023,
      company: 'Microsoft',
      role: 'Software Development Engineer II',
      skills: ['Azure AI', 'TypeScript', 'Next.js', 'Neo4j'],
      bio: '2023 CSE graduate building next-generation AI workflows for Microsoft 365.',
    },
  },
  {
    id: 'alumni_karthik',
    name: 'Karthik Raja',
    company: 'Apple',
    department: 'ECE',
    graduationYear: 2021,
    properties: {
      name: 'Karthik Raja',
      department: 'ECE',
      graduationYear: 2021,
      company: 'Apple',
      role: 'Hardware Systems Architect',
      skills: ['Silicon Design', 'Embedded C', 'Hardware Acceleration'],
      bio: 'ECE alumnus specializing in custom silicon architecture and low-power systems.',
    },
  },
  {
    id: 'alumni_ananya',
    name: 'Ananya Iyer',
    company: 'Amazon',
    department: 'IT',
    graduationYear: 2022,
    properties: {
      name: 'Ananya Iyer',
      department: 'IT',
      graduationYear: 2022,
      company: 'Amazon',
      role: 'Cloud Solutions Architect',
      skills: ['AWS Lambda', 'DynamoDB', 'Microservices', 'GraphQL'],
      bio: 'IT 2022 alumna helping enterprise clients scale modern cloud architectures.',
    },
  },
  {
    id: 'alumni_vikram',
    name: 'Vikram Seth',
    company: 'Google',
    department: 'CSE',
    graduationYear: 2020,
    properties: {
      name: 'Vikram Seth',
      department: 'CSE',
      graduationYear: 2020,
      company: 'Google',
      role: 'Machine Learning Research Engineer',
      skills: ['Deep Learning', 'PyTorch', 'Knowledge Graphs', 'Python'],
      bio: 'CSE 2020 graduate researching knowledge graph embeddings and LLM reasoning.',
    },
  },
  {
    id: 'alumni_neha',
    name: 'Neha Patel',
    company: 'Microsoft',
    department: 'CSE',
    graduationYear: 2021,
    properties: {
      name: 'Neha Patel',
      department: 'CSE',
      graduationYear: 2021,
      company: 'Microsoft',
      role: 'Product Manager - Developer Platform',
      skills: ['Product Strategy', 'Developer Experience', 'Agile'],
      bio: 'CSE 2021 alumna driving developer ecosystem innovations.',
    },
  },
  {
    id: 'alumni_rohan',
    name: 'Rohan Gupta',
    company: 'Amazon',
    department: 'IT',
    graduationYear: 2023,
    properties: {
      name: 'Rohan Gupta',
      department: 'IT',
      graduationYear: 2023,
      company: 'Amazon',
      role: 'Full Stack Engineer',
      skills: ['React', 'Node.js', 'AWS CDK', 'Graph Algorithms'],
      bio: 'IT 2023 graduate building scalable merchant dashboards.',
    },
  },
];

export const fallbackStats = {
  totalAlumni: fallbackAlumni.length,
  totalCompanies: fallbackCompanies.length,
  totalStudents: 1,
  departments: ['CSE', 'ECE', 'IT'],
  graduationYears: [2023, 2022, 2021, 2020],
};

export const fallbackGraph = {
  nodes: [
    ...fallbackCompanies.map((c) => ({
      id: c.id,
      name: c.name,
      label: 'Company',
      properties: c.companyProperties,
    })),
    ...fallbackAlumni.map((a) => ({
      id: a.id,
      name: a.name,
      label: 'Alumni',
      properties: a.properties,
    })),
    {
      id: 'student_rahul',
      name: 'Rahul Verma',
      label: 'Student',
      properties: { name: 'Rahul Verma', department: 'CSE', graduationYear: 2025 },
    },
  ],
  links: [
    { source: 'alumni_arun', target: 'comp_google', type: 'WORKS_AT', properties: {} },
    { source: 'alumni_vikram', target: 'comp_google', type: 'WORKS_AT', properties: {} },
    { source: 'alumni_priya', target: 'comp_microsoft', type: 'WORKS_AT', properties: {} },
    { source: 'alumni_neha', target: 'comp_microsoft', type: 'WORKS_AT', properties: {} },
    { source: 'alumni_karthik', target: 'comp_apple', type: 'WORKS_AT', properties: {} },
    { source: 'alumni_ananya', target: 'comp_amazon', type: 'WORKS_AT', properties: {} },
    { source: 'alumni_rohan', target: 'comp_amazon', type: 'WORKS_AT', properties: {} },
    { source: 'student_rahul', target: 'comp_google', type: 'INTERESTED_IN', properties: {} },
    { source: 'student_rahul', target: 'comp_microsoft', type: 'INTERESTED_IN', properties: {} },
  ],
};
