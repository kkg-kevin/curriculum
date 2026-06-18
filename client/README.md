# Full Stack School & Curriculum Management System

## Overview

This project follows a **Feature-Based Full Stack Architecture** designed for scalability, maintainability, and team collaboration.

The system is intended to manage:

* Schools
* Learners
* Teachers
* Classes
* Curriculum
* Assessments
* Reports
* User Management

The architecture separates the application into:

```text
client/  -> Frontend (React + Vite)
server/  -> Backend (Node.js + Express)
```

Both frontend and backend are organized by business domains rather than technical layers, making it easier to maintain and extend as the application grows.

---

# Project Architecture

```text
Full Stack Application
│
├── Client (Frontend)
│     ├── UI Components
│     ├── Feature Modules
│     ├── Routing
│     ├── State Management
│     └── API Integration
│
└── Server (Backend)
      ├── API Routes
      ├── Business Logic
      ├── Database Models
      ├── Validation
      └── Authentication
```

---

# Frontend Structure

```text
client/
```

The frontend is built using React and follows a feature-based architecture.

---

## public/

Contains publicly accessible static files.

Examples:

```text
favicon.ico
robots.txt
manifest.json
```

---

## src/

Main application source code.

---

# assets/

```text
src/assets/
```

Stores static resources used throughout the application.

Examples:

```text
images/
icons/
logos/
fonts/
```

---

# components/

```text
src/components/
```

Contains reusable components shared across multiple modules.

---

## components/ui/

Generic user interface components.

Examples:

```text
AppButton.jsx
AppInput.jsx
AppSelect.jsx
AppModal.jsx
AppDrawer.jsx
AppBadge.jsx
```

These components should not contain business logic.

Example:

```jsx
<AppButton>
  Save
</AppButton>
```

---

## components/tables/

Reusable table-related components.

Examples:

```text
DataTable.jsx
Pagination.jsx
TableToolbar.jsx
```

Used by:

* Schools
* Learners
* Teachers
* Reports

---

## components/charts/

Reusable chart components.

Examples:

```text
BarChart.jsx
LineChart.jsx
PieChart.jsx
```

Used in:

* Dashboard
* Reports
* Analytics

---

# layouts/

```text
src/layouts/
```

Defines page structures shared across multiple pages.

---

## MainLayout.jsx

Used for authenticated pages.

Contains:

```text
Sidebar
Header
Content Area
Footer
```

Example:

```jsx
<Sidebar />
<Header />
<Outlet />
```

---

## AuthLayout.jsx

Used for authentication-related pages.

Examples:

```text
Login
Forgot Password
Reset Password
```

---

# modules/

```text
src/modules/
```

The core of the frontend architecture.

Each feature contains:

```text
pages/
components/
services/
```

This keeps all functionality related to a specific business domain together.

---

# Dashboard Module

```text
modules/dashboard/
```

Responsible for application analytics and system overview.

### Pages

```text
Dashboard.jsx
```

Displays:

* Statistics
* Charts
* Recent Activity

### Components

```text
StatsCard.jsx
Charts.jsx
ActivityFeed.jsx
```

### Services

```text
dashboardApi.js
```

Handles API communication for dashboard data.

---

# Schools Module

```text
modules/schools/
```

Manages schools within the platform.

### Pages

```text
SchoolList.jsx
SchoolDetails.jsx
CreateSchool.jsx
```

### Components

```text
SchoolForm.jsx
SchoolCard.jsx
```

### Services

```text
schoolApi.js
```

Handles:

```text
Create School
Update School
Delete School
Fetch Schools
```

---

# Learners Module

```text
modules/learners/
```

Manages learner information and enrollment.

### Pages

```text
LearnerList.jsx
LearnerProfile.jsx
EnrollLearner.jsx
```

### Components

```text
LearnerForm.jsx
LearnerTable.jsx
```

### Services

```text
learnerApi.js
```

Handles learner CRUD operations.

---

# Teachers Module

```text
modules/teachers/
```

Manages teacher records and assignments.

### Pages

```text
TeacherList.jsx
TeacherProfile.jsx
```

### Components

```text
TeacherForm.jsx
TeacherCard.jsx
```

### Services

```text
teacherApi.js
```

Handles teacher operations.

---

# Classes Module

```text
modules/classes/
```

Responsible for class management.

### Pages

```text
ClassList.jsx
ClassDetails.jsx
```

### Components

```text
ClassForm.jsx
ClassRoster.jsx
```

### Services

```text
classApi.js
```

Handles class-related API requests.

---

# Curriculum Module

```text
modules/curriculum/
```

The central learning-content module.

Responsible for creating and managing curriculum structures.

---

## Curriculum Hierarchy

```text
Curriculum
└── Grade
     └── Subject
          └── Module
               └── Topic
                    └── Session
```

---

## Pages

```text
CurriculumList.jsx
CurriculumBuilder.jsx
```

### Curriculum Builder

Used to create and edit curriculum structures.

---

## Components

```text
ModuleEditor.jsx
TopicTree.jsx
```

### ModuleEditor

Manages:

```text
Learning Outcomes
Introduction
Main Concepts
Activities
Notes
Assignments
Resources
```

### TopicTree

Displays curriculum content using a collapsible tree structure.

Example:

```text
Mathematics
▼ Numbers
  ▼ Fractions
    Introduction
    Notes
    Activities
```

---

## Services

```text
curriculumApi.js
```

Handles:

```text
Create Curriculum
Update Curriculum
Assign Curriculum
Fetch Curriculum
```

---

# Assessments Module

```text
modules/assessments/
```

Responsible for testing and grading.

### Pages

```text
AssessmentList.jsx
CreateAssessment.jsx
```

### Components

```text
AssessmentForm.jsx
GradeEntry.jsx
```

### Services

```text
assessmentApi.js
```

Handles assessment operations.

---

# Reports Module

```text
modules/reports/
```

Responsible for analytics and reporting.

### Pages

```text
ReportsDashboard.jsx
LearnerReport.jsx
```

### Components

```text
ReportTable.jsx
ExportButtons.jsx
```

### Services

```text
reportApi.js
```

Handles report generation.

---

# Settings Module

```text
modules/settings/
```

Responsible for system administration.

### Pages

```text
Settings.jsx
UserManagement.jsx
```

### Components

```text
RoleManager.jsx
PermissionsTable.jsx
```

### Services

```text
settingsApi.js
```

Handles:

```text
User Management
Roles
Permissions
System Settings
```

---

# routes/

```text
src/routes/
```

Contains application routing configuration.

---

## AppRoutes.jsx

Defines all application routes.

Example:

```jsx
<Route path="/dashboard" />
<Route path="/schools" />
<Route path="/curriculum" />
```

---

# context/

```text
src/context/
```

Stores global application state.

---

## AuthContext.jsx

Stores:

```text
Authenticated User
Access Token
Permissions
Roles
```

Accessible throughout the application.

---

# hooks/

```text
src/hooks/
```

Contains reusable custom React hooks.

---

## useAuth.js

Authentication-related logic.

---

## useFetch.js

Reusable data fetching logic.

---

# services/

```text
src/services/
```

Contains application-wide API configuration.

---

## api.js

Centralized Axios instance.

Example:

```js
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});
```

All feature APIs use this instance.

---

# utils/

```text
src/utils/
```

Reusable helper functions and constants.

Examples:

```text
formatDate()
capitalize()
generateId()
```

---

# styles/

```text
src/styles/
```

Contains global styles and design system definitions.

---

# Backend Structure

```text
server/
```

The backend follows a modular architecture mirroring the frontend.

Each module contains:

```text
routes
controllers
services
models
validation
```

---

# Request Lifecycle

```text
Client Request
      │
      ▼
Routes
      │
      ▼
Controller
      │
      ▼
Service
      │
      ▼
Model
      │
      ▼
Database
      │
      ▼
Response
```

---

# Modules

Each backend module represents a business domain.

Example:

```text
modules/schools/
```

Contains:

```text
school.model.js
school.controller.js
school.service.js
school.routes.js
school.validation.js
```

---

## Model

Responsible for database schema definitions.

Example:

```js
School
{
  name,
  location,
  email,
  phone
}
```

---

## Controller

Handles:

```text
Request
Response
Status Codes
```

No business logic should live here.

---

## Service

Contains business rules.

Examples:

```text
Validation
Calculations
Data Processing
Authorization Checks
```

---

## Routes

Defines API endpoints.

Example:

```text
GET /schools
POST /schools
PUT /schools/:id
DELETE /schools/:id
```

---

## Validation

Handles request validation.

Examples:

```text
Required Fields
Email Validation
Phone Validation
```

---

# Shared Backend Components

```text
server/src/shared/
```

Reusable functionality used across modules.

---

## middleware/

### auth.middleware.js

Protects secured endpoints.

Responsibilities:

```text
Token Verification
Role Verification
Permission Checks
```

---

### error.middleware.js

Global error handling.

Responsibilities:

```text
Error Formatting
Status Codes
Logging
```

---

## utils/

Reusable helper functions.

Examples:

```text
generateSlug()
formatDate()
createPagination()
```

---

## validators/

Common validation utilities shared across modules.

---

# Configuration

```text
server/src/config/
```

Application configuration.

---

## db.js

Database connection setup.

Examples:

```text
MongoDB
PostgreSQL
MySQL
```

---

## env.js

Environment variable management.

Examples:

```text
PORT
DATABASE_URL
JWT_SECRET
```

---

# Complete Data Flow Example

```text
User Clicks Save School
        │
        ▼
SchoolForm.jsx
        │
        ▼
schoolApi.js
        │
        ▼
POST /schools
        │
        ▼
school.routes.js
        │
        ▼
school.controller.js
        │
        ▼
school.service.js
        │
        ▼
school.model.js
        │
        ▼
Database
        │
        ▼
Response
        │
        ▼
UI Updates
```

---

# Architectural Benefits

## Scalability

New modules can be added without affecting existing features.

Example:

```text
finance/
attendance/
communication/
library/
```

---

## Maintainability

All files related to a feature live together.

Example:

```text
schools/
├── pages/
├── components/
├── services/
```

Developers can quickly locate code.

---

## Team Collaboration

Frontend and backend developers can work independently on individual modules.

---

## Reusability

Shared components reduce duplication and improve consistency.

---

# Recommended Future Modules

```text
attendance/
finance/
communication/
notifications/
library/
timetable/
learning-resources/
analytics/
```

These can be added using the same architecture without major restructuring.
