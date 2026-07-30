# Class Visibility Fix - Implementation Summary

## Problem
Classes in the curriculum were not showing up in various selectors throughout the app, particularly when assigning educators to class/course combinations. The issue was caused by hardcoded `status: "active"` filters that unnecessarily restricted class visibility.

## Root Cause
Multiple UI components were applying the `status: "active"` filter both at the server request level and client-side, which prevented users from seeing all available classes.

### Files Affected:
1. **TeacherViewPage.jsx** - Educator-to-class assignment
2. **LearnerViewPage.jsx** - Learner enrollment and hub management

## Solution Implemented

### 1. TeacherViewPage.jsx (Line 67)
**Before:**
```javascript
queryFn:  () => classApi.getAll({ schoolId: selectedHubId, status: "active" }),
```

**After:**
```javascript
queryFn:  () => classApi.getAll({ schoolId: selectedHubId }),
```

**Impact:** Educators can now be assigned to courses in any class, regardless of status.

### 2. LearnerViewPage.jsx (Line 345)
**Before:**
```javascript
const classes = (classesData?.data || []).filter((c) => c.status === "active");
```

**After:**
```javascript
const classes = classesData?.data || [];
```

**Impact:** All classes are now visible when managing learner enrollments.

### 3. LearnerViewPage.jsx (Line 409)
**Before:**
```javascript
const classes = (classesData?.data || []).filter((c) => c.status === "active");
```

**After:**
```javascript
const classes = classesData?.data || [];
```

**Impact:** All classes are now available when enrolling learners in a new hub.

## Testing Checklist

- [ ] Navigate to Educators page and select an educator
- [ ] Click "Assign" button to assign educator to a class/course
- [ ] Verify all classes appear in the class dropdown (not just active ones)
- [ ] Select a hub and verify classes load correctly
- [ ] Try with both active and inactive classes
- [ ] Test educator assignment completes successfully

**Learner Enrollment:**
- [ ] Navigate to a Learner page
- [ ] In the enrollment section, select a hub
- [ ] Verify all classes appear in the class dropdown
- [ ] Test with both active and inactive classes
- [ ] Complete enrollment successfully

**Administrator Access:**
- [ ] Test as admin user
- [ ] Test as school admin user
- [ ] Verify branch admin access works

## Design Rationale

**Why remove all status filters?**
- Classes should be universally accessible for administrative tasks
- Status filters should be optional, not mandatory
- The curriculum model treats all classes as valid entities
- Users may need to assign educators/learners to inactive classes temporarily
- Filtering at the API level should be the user's choice, not enforced

**Why keep classes visible?**
- Curriculum changes should propagate immediately throughout the app
- No artificial restrictions on class visibility except role-based access control
- Consistency: if a class exists in the system, it should appear everywhere it's needed

## Related Code References

**Server-side filtering** (ClassModel.findAll):
```javascript
findAll({ schoolId, status } = {}) {
  let all = readAll();
  if (schoolId) all = all.filter((c) => c.schoolId === schoolId);
  if (status)   all = all.filter((c) => c.status === status);
  return all.sort(...);
}
```

The status filter is optional at the server level - it's only applied if explicitly requested. Our fix removes the client-side requests for filtered data, allowing the server to return all matching classes.

## Deployment Notes

- Changes are **backward compatible** - no API changes
- No database migrations needed
- Cache invalidation: React Query cache keys remain the same
- No breaking changes to existing functionality

## Future Considerations

1. **Optional UI-level filtering**: Could add a "Show inactive" toggle if needed for performance
2. **Status-based sorting**: Could sort active classes first, then inactive
3. **Audit logging**: Track when educators/learners are assigned to inactive classes
4. **Status warnings**: Show warnings when assigning to inactive classes (optional UX enhancement)
