# TimeCore Backend API Documentation
This document describes all REST API endpoints for the TimeCore backend. The API follows REST conventions and uses JSON for all requests and responses.
Base URL (local development): http://localhost:5000/api

## 🧩 Users -------------------------------------------------------------------------------------------------
### POST /users
Register a new user account. This endpoint is public and is intended to be used from the registration form. All newly created users will automatically get the role "user".

Request Body (JSON):
{
  "name": "User Name",
  "email": "user@example.com",
  "password": "Password123!",
  "tenantId": 1
}

Success Response (201):
{
  "message": "User created successfully",
  "user": {
    "id": 4,
    "name": "User Name",
    "email": "user@example.com",
    "tenant_id": 1,
    "role": "user",
    "is_active": 1
  }
}

Error Responses:
400 Bad Request – Missing or invalid fields
409 Conflict – Email already exists
500 Internal Server Error – Unexpected server or database error

## 🔐 Authentication -------------------------------------------------------------------------------------------------
### POST /auth/login
Authenticate a user with email and password. On success, a JWT token is stored in an HttpOnly cookie named tc_access. The token is not returned in the JSON body.

Request Body (JSON):
{
  "email": "user@example.com",
  "password": "Password123!"
}

Success Response (200):
{
  "message": "Login successful",
  "user": {
    "id": 4,
    "name": "User Name",
    "email": "user@example.com",
    "tenant_id": 1,
    "role": "user"
  }
}

Error Responses:
400 Bad Request – Missing or invalid fields
401 Unauthorized – Invalid email or password
403 Forbidden – User inactive or deleted
500 Internal Server Error – Unexpected server error

### GET /auth/me
Return the currently authenticated user based on the tc_access HttpOnly cookie. The browser automatically includes the cookie if credentials: "include" is enabled.

Success Response (200):
{
  "user": {
    "id": 4,
    "tenantId": 1,
    "role": "user",
    "email": "user@example.com"
  }
}

Error Responses:
401 Unauthorized – Missing or invalid cookie
500 Internal Server Error – Unexpected server error

### POST /auth/logout
Logs out the current user by clearing the tc_access cookie.

Success Response (200):
{
  "message": "Logged out successfully"
}

Error Responses:
500 Internal Server Error – Unexpected server error

### POST /auth/forgot-password
Start the password reset flow for a given email address. A reset token is generated and emailed (or logged in dev mode). This endpoint is public.

Request Body (JSON):
{
  "email": "user@example.com"
}

Success Response (200):
{
  "message": "If an account with that email exists, a password reset link has been sent."
}

Error Responses:
400 Bad Request – Missing or invalid email
500 Internal Server Error – Unexpected server error

### POST /auth/reset-password
Complete the password reset using a token and new password. The reset token is validated, the password updated, the token marked as used, and a new tc_access cookie is issued.

Request Body (JSON):
{
  "token": "rawResetTokenFromEmailOrLog",
  "password": "NewPassword123!"
}

Success Response (200):
{
  "message": "Password has been reset successfully",
  "user": {
    "id": 4,
    "name": "User Name",
    "email": "user@example.com",
    "tenant_id": 1,
    "role": "user"
  }
}


Error Responses:
400 Bad Request – Invalid token or weak password
403 Forbidden – User inactive or deleted
500 Internal Server Error – Unexpected server error

## 🔐 Admin Access
Some endpoints require admin privileges. To protect an endpoint, apply requireAuth followed by requireAdmin.

Example restricted endpoint:
GET /api/users → requires role "admin"

If not admin:
{
  "message": "You do not have permission to perform this action"
}

## 🏢 Tenants -------------------------------------------------------------------------------------------------
### GET /tenants
Return a list of all tenants (companies). This endpoint is public so it can be used in the registration form.

Success Response (200):
[
  {
    "id": 1,
    "name": "TimeCore AB",
    "org_number": "559123-4567"
  },
  {
    "id": 2,
    "name": "DevSolutions Sverige AB",
    "org_number": "556987-6543"
  }
]

Error Responses:
500 Internal Server Error – Unexpected server error while fetching tenants
