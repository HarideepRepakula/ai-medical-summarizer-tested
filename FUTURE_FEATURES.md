# ClinIQ — Future Production Features
> Current state: DEMO MODE (conflict checks disabled, no slot restrictions)
> When ready for production, search for `[DEMO]` in the codebase to find all demo shortcuts.

---

## 1. Appointment Slot Enforcement (15-min / 30-min slots)

**Files to update:**
- `backend/src/models/Appointment.js` — re-enable the unique index:
  ```js
  AppointmentSchema.index(
    { doctorId: 1, appointmentDate: 1, startTime: 1, status: 1 },
    { unique: true, partialFilterExpression: { status: { $in: ['pending','confirmed','in_progress'] } }, name: 'unique_active_appointment_slot' }
  );
  ```
- `backend/src/controllers/appointment.controller.js` — restore conflict check:
  ```js
  const conflicts = await AppointmentModel.findConflicts(doctor.userId, new Date(resolvedDate), resolvedStartTime, resolvedEndTime);
  if (conflicts.length > 0) return res.status(409).json({ success: false, error: 'This time slot is already booked' });
  ```
- Change `status: 'confirmed' // [DEMO]` back to `status: consultNow ? 'confirmed' : 'pending'`

**15-min slot support:**
- Change `TIME_SLOTS` in `Patient.jsx` to generate 15-min increments:
  ```js
  for (let h = 9; h < 17; h++) {
    for (const m of [0, 15, 30, 45]) { ... }
  }
  ```
- Update `endTime` auto-calculation from `+30` to `+15` minutes
- Update `durationMinutes` min from 0 to 15 in `Appointment.js` schema

---

## 2. Real-Time Slot Availability (Live Booked Slots)

**What to build:**
- `GET /api/appointments/availability?doctorId=X&date=Y` already exists — wire it to the booking modal
- Grey out already-booked slots in the time grid instead of hiding them
- Show "X slots left" counter per doctor card

**Files:**
- `frontend/src/pages/dashboards/Patient.jsx` — call `apiService.getDoctorAvailability(doctorId, date)` when date changes, mark booked slots as disabled

---

## 3. Doctor Schedule Management (Backend Persistence)

**What to build:**
- Save `ScheduleManagement` slots to DB via `POST /api/schedule/add-slot` and `POST /api/schedule/block-time`
- Load doctor's saved schedule on dashboard mount
- `GET /api/appointments/availability` should respect blocked slots

**Files:**
- `backend/src/controllers/schedule.controller.js` — already exists, wire it up
- `frontend/src/pages/dashboards/Doctor.jsx` — `ScheduleManagement` component: replace `useState(DEFAULT_SCHEDULE)` with API calls

---

## 4. 3-Hour Cancellation / Reschedule Lock

Currently disabled for demo. Re-enable by restoring the `hoursUntil` check in:
- `cancelAppointment` — patients cannot cancel < 3 hours before
- `rescheduleAppointment` — patients cannot reschedule < 3 hours before

```js
if (userRole === 'PATIENT') {
  const hrs = hoursUntil(appointment.appointmentDate, appointment.startTime);
  if (hrs < 3) return res.status(423).json({ success: false, error: 'Cannot cancel/reschedule less than 3 hours before appointment.' });
}
```

---

## 5. Payment Gateway Integration

**Current state:** Fake 2-second payment delay in `handleFakePayment()`

**To implement:**
- Integrate Razorpay or Stripe
- Replace `handleFakePayment` in `Patient.jsx` with real payment flow:
  1. `POST /api/payments/create-order` → get order ID
  2. Open Razorpay checkout
  3. On success callback → `POST /api/appointments/book` with `paymentId`
- Update `Appointment.paymentStatus` from `'pending'` to `'paid'`

---

## 6. T-10 / T-15 Consultation Lock System

**What it does:** 10 minutes before appointment:
- Patient's pre-consult notes lock and share with doctor
- Doctor's AI summary becomes visible
- File uploads lock (T-15)

**Current state:** Logic exists in backend but frontend doesn't poll for it.

**To implement:**
- In `ConsultationPrep.jsx` — poll `GET /api/appointments/:id/lock-state` every 60 seconds
- Show countdown timer to appointment
- Disable note editing when `summaryLocked === true`

---

## 7. Video Consultation (WebRTC / Jitsi)

**To implement:**
- Add `meetingUrl` field to Appointment model
- On booking confirmation, generate a Jitsi room URL: `https://meet.jit.si/cliniq-{appointmentId}`
- Show "Join Meeting" button in `ConsultationPrep` when `isMeetingEnabled === true` (T-15)

---

## 8. SMS / Email Notifications

**Current state:** `notificationService.js` exists but may not be wired to a real provider.

**To implement:**
- Integrate Twilio (SMS) or SendGrid (email)
- Triggers: booking confirmed, 24h reminder, doctor reschedule, cancellation
- Add `TWILIO_SID`, `TWILIO_TOKEN`, `SENDGRID_KEY` to `.env`

---

## 9. Admin Analytics Dashboard

**To implement:**
- Wire real data to Admin dashboard KPI cards (currently hardcoded)
- `GET /api/admin/audit-report` already exists — display it
- Add charts: appointments per day, revenue, doctor utilization

---

## 10. MongoDB Replica Set (for Transactions)

**Why:** `session.withTransaction()` requires a replica set. Currently removed for demo.

**To enable locally:**
```bash
# Stop mongod, then start as replica set:
mongod --replSet rs0 --dbpath /data/db
# In mongo shell:
rs.initiate()
```

**Then restore** `session.withTransaction()` in `appointment.controller.js` for atomic operations on cancel/reschedule.

---

## Demo → Production Checklist

| # | Task | File | Search for |
|---|------|------|-----------|
| 1 | Re-enable unique slot index | `Appointment.js` | `[DEMO] Unique slot index` |
| 2 | Re-enable conflict check | `appointment.controller.js` | `[DEMO] Conflict check` |
| 3 | Restore pending status | `appointment.controller.js` | `[DEMO] always confirmed` |
| 4 | Re-enable 3-hour lock | `appointment.controller.js` | `THREE_HOUR_LOCK` |
| 5 | Real payment gateway | `Patient.jsx` | `handleFakePayment` |
| 6 | MongoDB replica set | `index.js` | `mongoUri` |
| 7 | Restore transactions | `appointment.controller.js` | `startSession` |
