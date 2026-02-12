import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: 'Hospital Attendance API',
      version: '1.1.0',
      description:
        'Dokumentasi API untuk registrasi, validasi, identifikasi, absensi, dan CRUD user management.',
    },
    servers: [
      {
        url: origin,
        description: 'Current Environment',
      },
    ],
    tags: [
      { name: 'User' },
      { name: 'Attendance' },
      { name: 'System' },
    ],
    paths: {
      '/api/user/register': {
        post: {
          tags: ['User'],
          summary: 'Register user baru atau overwrite user existing',
          description:
            'Default akan menolak overwrite jika employeeId sudah ada (409 EMPLOYEE_EXISTS). Kirim confirmOverwrite=true untuk overwrite data wajah user existing.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'employeeId', 'faceDescriptors'],
                  properties: {
                    name: { type: 'string', example: 'Dr. Raka Pratama' },
                    role: {
                      type: 'string',
                      enum: ['Surgeon', 'Doctor', 'Nurse', 'Admin'],
                      example: 'Doctor',
                    },
                    employeeId: { type: 'string', example: 'EMP-0042' },
                    confirmOverwrite: { type: 'boolean', example: false },
                    faceDescriptors: {
                      type: 'array',
                      items: {
                        type: 'array',
                        items: { type: 'number' },
                      },
                      description: 'Array descriptor wajah hasil continuous modeling.',
                    },
                  },
                },
                examples: {
                  registerSample: {
                    summary: 'Contoh payload register',
                    value: {
                      name: 'Dr. Raka Pratama',
                      role: 'Doctor',
                      employeeId: 'EMP-0042',
                      confirmOverwrite: false,
                      faceDescriptors: [
                        [0.12, -0.08, 0.33, -0.04, 0.09, -0.16, 0.21, 0.02],
                        [0.1, -0.09, 0.34, -0.06, 0.11, -0.17, 0.19, 0.01],
                      ],
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'User updated (overwrite).' },
            201: { description: 'User created.' },
            400: { description: 'Invalid payload.' },
            409: {
              description: 'Conflict: employee exists atau face conflict ke user lain.',
            },
          },
        },
      },
      '/api/user/validate': {
        post: {
          tags: ['User'],
          summary: 'Validasi employeeId dan conflict descriptor wajah',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    employeeId: { type: 'string', example: 'EMP-0042' },
                    faceDescriptor: {
                      type: 'array',
                      items: { type: 'number' },
                    },
                    excludeUserId: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Validation result.' },
          },
        },
      },
      '/api/user/identify': {
        post: {
          tags: ['User'],
          summary: 'Identifikasi wajah dari descriptor',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['faceDescriptor'],
                  properties: {
                    faceDescriptor: {
                      type: 'array',
                      items: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Match ditemukan.' },
            404: { description: 'User tidak ditemukan.' },
          },
        },
      },
      '/api/users': {
        get: {
          tags: ['User'],
          summary: 'List user (searchable)',
          parameters: [
            {
              name: 'q',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Cari by name, employeeId, role.',
            },
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: { type: 'integer', default: 50 },
            },
          ],
          responses: {
            200: { description: 'List user berhasil.' },
          },
        },
        post: {
          tags: ['User'],
          summary: 'Create user baru (CRUD)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'employeeId', 'faceDescriptors'],
                  properties: {
                    name: { type: 'string' },
                    role: { type: 'string', enum: ['Surgeon', 'Doctor', 'Nurse', 'Admin'] },
                    employeeId: { type: 'string' },
                    faceDescriptors: {
                      type: 'array',
                      items: {
                        type: 'array',
                        items: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'User created.' },
            409: { description: 'Employee ID exists.' },
          },
        },
      },
      '/api/users/{id}': {
        get: {
          tags: ['User'],
          summary: 'Get detail user by id',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            200: { description: 'User found.' },
            404: { description: 'User not found.' },
          },
        },
        put: {
          tags: ['User'],
          summary: 'Update user profile/descriptors',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    role: { type: 'string', enum: ['Surgeon', 'Doctor', 'Nurse', 'Admin'] },
                    employeeId: { type: 'string' },
                    faceDescriptors: {
                      type: 'array',
                      items: {
                        type: 'array',
                        items: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'User updated.' },
            404: { description: 'User not found.' },
            409: { description: 'Employee ID exists.' },
          },
        },
        delete: {
          tags: ['User'],
          summary: 'Delete user + cascade attendance',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['confirmEmployeeId'],
                  properties: {
                    confirmEmployeeId: { type: 'string', example: 'EMP-0042' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'User deleted.' },
            400: { description: 'Confirmation mismatch.' },
            404: { description: 'User not found.' },
          },
        },
      },
      '/api/attendance/log': {
        post: {
          tags: ['Attendance'],
          summary: 'Catat absensi (manual atau auto)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    userId: { type: 'string', example: '65f123abc456def789012345' },
                    type: { type: 'string', enum: ['Check-in', 'Check-out'], example: 'Check-in' },
                    faceDescriptor: {
                      type: 'array',
                      items: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Attendance success.' },
            400: { description: 'Invalid request.' },
            404: { description: 'Face/User not found.' },
          },
        },
      },
      '/api/reset-db': {
        post: {
          tags: ['System'],
          summary: 'Reset semua data user & attendance',
          responses: {
            200: { description: 'DB reset success' },
          },
        },
      },
    },
  };

  return NextResponse.json(openApiSpec);
}
