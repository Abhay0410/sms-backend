# SaaS PLATFORM & SUPER ADMIN LAYER - IMPLEMENTATION PLAN

## 1. Overview & Objective
Currently, the backend is a fully functional **Multi-Tenant System** where every piece of data is scoped by `schoolId`. 
To convert this into a **SaaS Product**, we need a top-level layer (Super Admin) that exists *above* the schools. 
This layer will handle onboarding new schools, managing subscriptions (billing, plans), restricting access based on plans, and viewing global platform analytics.

---

## 2. Core Architectural Changes
### 2.1. The Actor Hierarchy
1. **Super Admin**: Platform Owner (You). Manages schools, billing, and global settings.
2. **School Admin**: Tenant Owner. Manages their specific school's operations (Teachers, Students, Fees).
3. **Users**: Teachers, Students, Parents.

### 2.2. Feature Toggling & Plan Limits
Not all schools will pay for all features. We need a way to block access to modules (like Transport or Inventory) if a school is on a "Basic" plan, or block creating new students if they exceed their `maxStudents` limit.

---

## 3. Database Schema Additions & Modifications

### 3.1. Super Admin Model (`models/SuperAdmin.js`)
A separate collection for platform owners.
```javascript
const superAdminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'SUPER_ADMIN' }, // Could be SUPPORT or ADMIN
  lastLogin: Date
}, { timestamps: true });
```

### 3.2. Subscription Plan Model (`models/SubscriptionPlan.js`)
To avoid hardcoding limits in the School model, we create a master list of plans.
```javascript
const planSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // e.g., 'BASIC', 'PREMIUM'
  monthlyPrice: { type: Number, required: true },
  yearlyPrice: { type: Number, required: true },
  limits: {
    maxStudents: { type: Number, required: true },
    maxStorageMB: { type: Number, default: 5000 }
  },
  features: [{ type: String }] // e.g., ['TRANSPORT', 'INVENTORY', 'PAYROLL']
}, { timestamps: true });
```

### 3.3. Update School Model (`models/School.js`)
Add SaaS-specific tracking fields.
```javascript
// Additions to existing School Schema:
  subdomain: { type: String, unique: true, sparse: true, lowercase: true }, // e.g., 'dps.zager.com'
  subscription: {
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    status: { type: String, enum: ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED'], default: 'TRIAL' },
    trialEndsAt: Date,
    billingCycle: { type: String, enum: ['MONTHLY', 'YEARLY'] },
    nextBillingDate: Date
  },
  modulesEnabled: [{ type: String }] // Extracted from plan upon subscription
```

---

## 4. The Registration & Onboarding Pipeline

### Scenario A: Self-Service Registration (Automated)
1. **Landing Page:** User visits `zager.com/pricing` and selects a plan.
2. **Sign Up API:** Submits School Name, Admin Email, Password.
3. **The `registerTenant` Logic:**
   - Validates uniqueness of domain/email.
   - Creates `School` document (Status: TRIAL).
   - Creates `Admin` document (Role: SCHOOL_ADMIN, linked to new `SchoolId`).
   - Seeds default data (e.g., Default Expense Categories, Default Session).
   - Sends Welcome Email with magic login link.

### Scenario B: Super Admin Assisted Onboarding (Manual)
1. Super Admin logs into Platform Dashboard.
2. Clicks "Add New School".
3. Fills in school details and assigns a starting plan.
4. System generates credentials and emails the School Principal.

---

## 5. API Design (Super Admin Layer)

All these routes should be prefixed with `/api/superadmin` and protected by a `superAdminAuth` middleware.

### 5.1. Authentication
- `POST /api/superadmin/auth/login`

### 5.2. Tenant (School) Management
- `POST /api/superadmin/schools` (Register a new school)
- `GET /api/superadmin/schools` (List all schools with search/pagination)
- `GET /api/superadmin/schools/:id` (View school details & usage stats)
- `PUT /api/superadmin/schools/:id/status` (Suspend/Activate a school - e.g., if they didn't pay)
- `PUT /api/superadmin/schools/:id/plan` (Upgrade/Downgrade their plan)

### 5.3. Plan Management
- `POST /api/superadmin/plans` (Create new pricing tier)
- `GET /api/superadmin/plans`

### 5.4. Global Analytics
- `GET /api/superadmin/analytics/dashboard`
  - Returns: Total Schools, Total Active Students (aggregated across all tenants), Monthly Recurring Revenue (MRR), Trial Conversions.

---

## 6. Middleware & Security Enhancements

### 6.1. Subscription Enforcement Middleware
Before any school admin or teacher accesses a route, we must ensure their school's account is in good standing.
Create `middleware/subscriptionCheck.js`:
```javascript
export const requireActiveSubscription = async (req, res, next) => {
  const school = await School.findById(req.schoolId);
  
  if (school.subscription.status === 'PAST_DUE' || school.subscription.status === 'CANCELLED') {
    return res.status(402).json({ 
      success: false, 
      message: 'Account suspended due to unpaid invoices. Please contact support.' 
    });
  }
  next();
};
```

### 6.2. Feature Gate Middleware
To block schools on basic plans from accessing premium APIs.
```javascript
export const requireModule = (moduleName) => {
  return async (req, res, next) => {
    const school = await School.findById(req.schoolId);
    if (!school.modulesEnabled.includes(moduleName)) {
      return res.status(403).json({ success: false, message: 'Please upgrade your plan to use this feature.' });
    }
    next();
  };
};
```
*Usage:* `app.use('/api/admin/transport', requireModule('TRANSPORT'), transportRoutes);`

---

## 7. Next Steps for Implementation
1. **Create the Models**: `SuperAdmin` and `SubscriptionPlan`.
2. **Update `School` Model**: Add the fields mentioned in section 3.3.
3. **Implement Middleware**: Create the `superAdminAuth` middleware.
4. **Develop Controllers**: Scaffold the `/controllers/superadmin/` directory.
5. **Refactor Auth**: Ensure the standard `/api/auth/admin/login` gracefully handles suspended schools.