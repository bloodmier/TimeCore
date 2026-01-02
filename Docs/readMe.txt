## TimeCore

TimeCore is a multi-tenant time reporting and administration system developed as an individual degree project.

The system allows users to register working time and materials, administrators to review reported work, and invoices to be created and sent via Fortnox.

The project is designed to resemble a real-world business system with clear separation between frontend, backend, database, and external integrations.



## Tech Stack

Frontend:
- React
- Vite
- TypeScript
- Tailwind CSS

Backend:
- Node.js
- Express

Database:
- MySQL / MariaDB

Authentication:
- JWT using HttpOnly cookies

External services:
- Fortnox API
- Server-side PDF generation



## Requirements

- Node.js version 18 or newer
- MySQL or MariaDB
- npm



## Project Structure

frontend/
Frontend application (React + Vite)

backend/
Backend API (Node.js + Express)

docs/
Database schema and technical documentation

.env.example
Core backend environment configuration

.fortnox.env.example
Fortnox API configuration

fortnox_token.example.json
Example Fortnox OAuth token structure

Sensitive files are excluded via .gitignore.



## Backend Setup

1. Navigate to the backend folder

2. Install dependencies:
   npm install

3. Create environment files:
   - Copy .env.example to .env
   - Copy .fortnox.env.example to .fortnox.env

4. Fill in all required values in both files

5. Import the database schema  
   The full SQL schema is provided in the docs folder

6. Start the backend:
   npm run dev



## Frontend Setup

1. Navigate to the frontend folder

2. Install dependencies:
   npm install

3. Create a .env file and set the API base URL:
   VITE_API_BASE_URL=http://localhost:5000/api

4. Start the frontend:
   npm run dev



## Environment Configuration

The backend loads environment variables from two files.

.env  
Contains core application configuration such as:
- Server port
- Database connection
- JWT secrets
- SMTP / email settings
- Frontend origin

.fortnox.env  
Contains Fortnox-specific configuration:
- OAuth client ID and secret
- Redirect URI
- Requested scopes
- Production flag

Example files are provided and must be copied before starting the application.



## Fortnox Integration

TimeCore integrates with Fortnox for:
- Customer synchronization
- Invoice creation
- Sending invoices with optional PDF attachments

Fortnox OAuth tokens are stored locally in:
fortnox_token.json

This file is created automatically during authorization and is not committed to the repository.

An example structure is provided in:
fortnox_token.example.json



## Manual System Configuration (Important)

At this stage, the system does not include a settings interface.

Several configuration steps must therefore be performed manually in the database.



## Customers and Companies

Each company must exist in the customer table.

customer.customer_id  
Must match the Fortnox CustomerNumber

tenants.customer_id  
Links a tenant to a customer

This connection is required for correct invoice ownership and Fortnox integration.



## Tenants and Users

Users belong to a company via users.tenant_id.

The tenant_id determines which company the user belongs to.

A tenant must be linked to a customer to enable invoicing.



## Billing Ownership (Parent / Subsidiary Companies)

The customer table supports billing hierarchies.

billing_owner  
Indicates whether the customer is a billing parent company

customer_owner  
If set, invoices may be redirected to the owner company

bill_direct  
- 1 → invoice is sent directly to this customer  
- 0 → invoice is sent to the billing owner (if defined)

This allows scenarios where work is performed for a subsidiary but invoiced to a parent company.



## PDF and Email Handling

include_attachments_on_send  
Controls whether generated worklog PDFs are attached when invoices are sent via Fortnox

customer_email table  
A customer can have multiple email addresses

send_pdf = 1  
PDF is sent directly to that email address



## Language Settings

customer.language controls the language used for generated PDFs.

Possible values:
- sv (Swedish)
- en (English)



## User Pricing Levels

User hourly pricing is managed via:
- user_pricing_levels
- users.level_id

If a customer-specific hourly rate is not defined:

Labor cost is calculated based on the user’s pricing level.

These prices are applied when invoices are created in Fortnox.



## Articles and Materials

The articles table stores products and materials.

Article number 87 is used as the default material article.

New products can be added dynamically if they do not already exist.

All registered material items are stored in:
time_report_item

If a purchase price exists:

The price is multiplied by a configurable markup.

The markup is defined via the environment variable:
ARTICLE_MULTIPLIER (default: 1.07)



## Time Report Categories

All time reports require a category.

Categories must be defined manually in:
time_report_categories

These categories are selectable in the frontend.



## Projects

Projects can be linked to customers via the project table.

If a customer has active projects, a project selector is shown in the frontend.

Projects are included in time reports and invoices.



## Notes

There is currently no settings UI; configuration is database-driven.

Sensitive files (.env, .fortnox.env, tokens) are excluded via .gitignore.

The system is designed to be extended with admin configuration views in future versions.



## Status

This project was developed as a degree project and demonstrates:

- Multi-tenant system design
- Secure authentication
- Database-driven business logic
- External API integration
- Real-world backend architecture
