# Admin API Reference

This document lists the admin-facing API endpoints, request bodies, and example responses. All admin endpoints require authentication. Use the `Authorization` header: `Bearer <token>`.

Base URL (development): http://localhost:3000

---

## 1) Login

- URL: POST /api/users/login
- Auth: Public

Request body (JSON):
{
  "uid": "admin@example.com",   // email or user uid
  "password": "yourPassword",
  "fcmToken": "optional-device-fcm-token"
}

Success Response (200):
{
  "message": "Login successful",
  "user": {
    "id": "cj...",
    "uid": "KMUSER-XXXXXX",
    "name": "Admin Name",
    "email": "admin@example.com",
    "phone": "9999999999",
    "role": "ADMIN",
    "isActive": true,
    "createdAt": "2025-10-23T...",
    "fcmToken": "(if provided)"
  },
  "token": "<session-token>",
  "expiresIn": "24h"
}

Error (401): invalid credentials.

Example (cmd.exe curl):
curl -X POST "http://localhost:3000/api/users/login" -H "Content-Type: application/json" -d "{\"uid\":\"admin@example.com\",\"password\":\"default123\",\"fcmToken\":\"abcdef\"}"

---

## 2) Dashboard (admin view)

- URL: GET /api/users/dashboard?role=ADMIN
- Auth: Bearer token

Query params:
- role=ADMIN

Success Response (200):
{
  "role": "ADMIN",
  "totalUsers": 12,
  "activeServices": 34,
  "totalCustomers": 78,
  "openIssues": 9
}

Example (cmd.exe curl):
curl -X GET "http://localhost:3000/api/users/dashboard?role=ADMIN" -H "Authorization: Bearer <token>"

Notes:
- This returns aggregated KPIs useful for administrators.

---

## 3) Customers

### 3.1 List customers
- URL: GET /api/customers
- Auth: Bearer token
- Optional query params: `q` (search), `limit`, `offset` or `page` (if implemented), `sort`.

Success Response (200):
{
  "message": "Customers retrieved successfully",
  "count": 2,
  "customers": [
    {
      "id": "cuid...",
      "uid": "KM-XXXX",
      "name": "Customer A",
      "phone": "9999999999",
      "email": "cust@example.com",
      "address": "Address",
      "createdAt": "2025-10-23T..."
    }
  ]
}

Example:
curl -X GET "http://localhost:3000/api/customers" -H "Authorization: Bearer <token>"

### 3.2 Create customer
- URL: POST /api/customers
- Auth: Bearer token (ADMIN/Sales)

Request body (JSON):
{
  "name": "Customer A",
  "phone": "9999999999",
  "email": "cust@example.com",
  "address": "Street, City"
}

Success Response (201):
{
  "message": "Customer created successfully",
  "customer": {
     "id": "cuid...",
     "uid": "KM-XXXX",
     "name": "Customer A",
     "phone": "9999999999",
     "email": "cust@example.com",
     "address": "Street, City",
     "createdAt": "2025-10-23T..."
  }
}

### 3.3 Get specific customer
- URL: GET /api/customers/:id
- Auth: Bearer token

Success Response (200):
{
  "message": "Customer retrieved successfully",
  "customer": { /* full customer object, includes serviceRecords in include if implemented */ }
}

---

## 4) Service Records (list/create/get with points and reports)

### 4.1 List service records
- URL: GET /api/service-records
- Auth: Bearer token
- Optional query params: `status`, `customerId`, `engineerId`, `limit`, `offset`

Success Response (200):
{
  "message": "Service records retrieved successfully",
  "count": 2,
  "serviceRecords": [
    {
      "id": "sr_cuid",
      "customerId": "cuid...",
      "machineId": "muid...",
      "purchaseDate": "2025-08-01T...",
      "warrantyExpiresAt": "2026-08-01T...",
      "pendingAmount": 1200.5,
      "status": "ACTIVE",
      "createdById": "userId",
      "createdAt": "2025-08-01T..."
    }
  ]
}

### 4.2 Create service record
- URL: POST /api/service-records
- Auth: Bearer token

Request body (JSON):
{
  "customerId": "cuid...",
  "machineId": "muid...",
  "purchaseDate": "2025-08-01T00:00:00.000Z",
  "warrantyExpiresAt": "2026-08-01T00:00:00.000Z",
  "pendingAmount": 0,
  "kpis": { "uptime": 99.9 }
}

Success Response (201):
{
  "message": "Service record created successfully",
  "serviceRecord": { /* service record object */ }
}

### 4.3 Get specific service record (with points and reports)
- URL: GET /api/service-records/:id
- Auth: Bearer token

Success Response (200):
{
  "message": "Service record retrieved successfully",
  "serviceRecord": {
    "id": "sr_cuid",
    "customer": { "id": "cuid...", "name": "Customer A" },
    "machine": { "id": "muid...", "name": "Machine X" },
    "pendingAmount": 1200.5,
    "status": "ACTIVE",
    "points": [
      {
        "id": "point_cuid",
        "title": "Fix wiring",
        "description": "...",
        "status": "ASSIGNED",
        "assignedToId": "engineerId",
        "createdAt": "..."
      }
    ],
    "reports": [
      {
        "id": "report_cuid",
        "engineerId": "engineerId",
        "reportData": { /* JSON */ },
        "manualUrl": "uploads/manuals/...")
      }
    ]
  }
}

Notes:
- The controller typically includes `points` and `reports` via Prisma `include` when fetching a single service record.

---

## 5) Machines

### 5.1 Add machine
- URL: POST /api/machines
- Auth: Bearer token

Request body (JSON):
{
  "name": "Compressor A",
  "category": "Compressor",
  "brand": "BrandX",
  "warrantyTimeInMonths": 24,
  "serialNumber": "SN12345"
}

Success Response (201):
{
  "message": "Machine created successfully",
  "machine": {
    "id": "muid...",
    "name": "Compressor A",
    "category": "Compressor",
    "brand": "BrandX",
    "warrantyTimeInMonths": 24,
    "serialNumber": "SN12345",
    "createdAt": "2025-..."
  }
}

### 5.2 List machines
- URL: GET /api/machines
- Auth: Bearer token

Success Response (200):
{
  "message": "Machines retrieved successfully",
  "count": 10,
  "machines": [ /* machine objects */ ]
}

---

## 6) Users (create, change password)

### 6.1 Create user (Admin only)
- URL: POST /api/users
- Auth: Bearer token (Admin role required)

Request body (JSON):
{
  "name": "John Engineer",
  "email": "eng1@example.com",
  "phone": "9999999999",
  "role": "ENGINEER",
  "password": "secret123"  // optional: if omitted default assigned
}

Success Response (201):
{
  "message": "User created successfully",
  "user": {
    "id": "uid...",
    "uid": "KMUSER-XXXX",
    "name": "John Engineer",
    "email": "eng1@example.com",
    "phone": "9999999999",
    "role": "ENGINEER",
    "isActive": true
  }
}

### 6.2 Change password (Authenticated user)
- URL: PUT /api/users/change-password
- Auth: Bearer token

Request body (JSON):
{
  "currentPassword": "oldpass",
  "newPassword": "newpass123"
}

Success Response (200):
{ "message": "Password changed successfully" }

Error (401): Invalid current password.

---

## 7) Admin Dashboard (extra admin-only KPIs)

These are admin-specific endpoints or variations of the dashboard. The main admin dashboard endpoint is the same as `GET /api/users/dashboard?role=ADMIN` but you may want additional endpoints for deeper reports e.g.

- URL: GET /api/admin/reports/summary?from=2025-01-01&to=2025-10-24
- Auth: Bearer token (ADMIN)

Response Example (200):
{
  "totalInstallations": 234,
  "totalCompletedServices": 190,
  "totalPendingPayments": 23,
  "totalPendingAmount": 452000.5,
  "openServiceIssues": 12
}

(Implementation: add a controller method aggregating service records, sum pendingAmount, count statuses, etc.)

---

## Notes & Tips
- All timestamps are ISO strings.
- Use the `Authorization: Bearer <token>` header for authenticated endpoints. Current simple token is the `user.id` from login response. Consider migrating to JWT for production.
- When creating / updating entities that accept nested arrays (points, reports), send them as JSON objects where the controller supports it. For file uploads (reports/manuals), use the upload endpoints which accept multipart form-data.
- For push notifications to devices ensure devices supply `fcmToken` and that it is saved in `users.fcmToken` either via login (sent in login request) or via `PUT /api/users/fcm-token`.

---

If you'd like, I can:
- Add concrete `curl` examples for every endpoint including JSON payloads (cmd.exe-ready). 
- Generate a single OpenAPI (Swagger) spec from these docs so you can import into Postman or generate client code.
- Add a small `admin/test-push` endpoint so you can test FCM pushes directly and return the FCM `messageId` in the HTTP response.

