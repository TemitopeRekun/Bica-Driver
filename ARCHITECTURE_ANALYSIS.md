# BICA Driver - Trip Flow Architecture & Critical Issues

## 🏗️ Trip Flow Overview

```
OWNER (Passenger) Flow:
┌─────────────────────────────────────────────────────────────────────┐
│ RequestRideScreen (IDLE)                                            │
│  ├─ Search pickup/destination → Calculate route                    │
│  ├─ Fetch nearby drivers (transmission filter)                      │
│  └─ Select driver + initiate request (idempotent POST /rides)       │
│        ↓ State: SEARCHING                                           │
│ ─────────────────────────────────────────────────────────────────   │
│ TripStatusScreen (ASSIGNED)                                         │
│  ├─ WebSocket: ride:accepted → Show driver info + ETA              │
│  ├─ OTP display for pickup verification                             │
│  ├─ Trip in progress tracking                                       │
│  └─ WebSocket: trip:completed                                       │
│        ↓ State: COMPLETED                                           │
│ ─────────────────────────────────────────────────────────────────   │
│ PaymentCompleteScreen (Verifying Payment)                           │
│  ├─ Redirect from Monnify checkout                                  │
│  ├─ Poll /payments/status every 2.5s (max 48 times)               │
│  ├─ OR WebSocket: payment:updated                                   │
│  └─ Auto-navigate on PAID                                           │
│        ↓ State: COMPLETED (paid)                                    │
│ ─────────────────────────────────────────────────────────────────   │
│ RateDriverScreen (if pending)                                       │
│  └─ Submit rating (1-5 stars)                                       │
│        ↓                                                             │
│ OwnerActivityScreen (Dashboard)                                     │
└─────────────────────────────────────────────────────────────────────┘

DRIVER Flow:
┌─────────────────────────────────────────────────────────────────────┐
│ DriverMainScreen                                                    │
│  └─ "Go Online" button                                              │
│     ├─ Request GPS permission                                       │
│     ├─ POST /users/online { isOnline: true, lat, lng }             │
│     ├─ Socket.io connect & register                                 │
│     └─ Boot-time sync: GET /rides/current (recover pending)        │
│        ↓ State: ONLINE                                              │
│ ─────────────────────────────────────────────────────────────────   │
│ Live Request Cards (via WebSocket ride:assigned / ride:request)   │
│  ├─ Show: passenger name, pickup, destination, fare               │
│  ├─ Driver swipes to accept                                        │
│  └─ POST /rides/{tripId}/accept (or implicit via WebSocket)       │
│        ↓ State: ASSIGNED                                            │
│ ─────────────────────────────────────────────────────────────────   │
│ Navigation to Pickup                                                │
│  ├─ Real-time driver location broadcast (PATCH /users/location)   │
│  ├─ Socket: locationupdated → propagate to owner map               │
│  └─ Verify OTP at pickup                                            │
│        ↓ Milestone: arrived                                         │
│ ─────────────────────────────────────────────────────────────────   │
│ Trip In Progress                                                    │
│  ├─ Continue broadcasting location                                 │
│  └─ WebSocket: trip:completed                                      │
│        ↓ Milestone: completed                                       │
│ ─────────────────────────────────────────────────────────────────   │
│ AwaitingPaymentScreen (Verify Payment)                             │
│  ├─ Poll /payments/status every 5s (max 120 times)                │
│  ├─ WebSocket: payment:updated                                     │
│  └─ On PAID → auto-navigate to DriverActivityScreen               │
│        ↓ State: CLEARED                                             │
│ DriverActivityScreen (Dashboard)                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔗 State Management

**Primary Store: `useRideStore` (Zustand + localForage)**
```typescript
rideState:       'IDLE' | 'SEARCHING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'SCHEDULED'
rideMilestone:   'requested' | 'scheduled' | 'assigned' | 'arrived' | 'in_progress' | 'completed'
currentTripId:   string | null
driverInfo:      { id, name, phone, rating, car, plate, otp, acceptanceImageUrl, timeAway, ... }
trackedDriverPos: [lat, lng] | null
pickup:          LocationData { lat, lon, display_name, ... }
destination:     LocationData
```

**Persisted Fields:** rideState, rideMilestone, currentTripId, driverInfo, pickup, destination

**Auth Store: `useAuthStore`**
```typescript
currentUser:     UserProfile | null
lastUserId:      string | null  // Session identity validation
```

**Connectivity Store: `useConnectivityStore`**
```typescript
isOnline:            boolean
isSocketConnected:   boolean
socketEverConnected: boolean  // Track if socket ever connected (for proper fallback)
```

---

## 🌐 Key Integration Points

### **Services Layer**

#### **api.service.ts** (REST Client)
- **Idempotency**: All mutations (POST/PATCH/PUT/DELETE) auto-generate UUID idempotency keys for safe retries
- **Token Refresh**: 401 → silent refresh once → logout if fails
- **Retry Logic**:
  - GETs: 3 attempts with exponential backoff on 5xx
  - Mutations: Retry if idempotency key present AND network failure
- **Rate Limiting**: 429 → 5s throttle (global)
- **Error Normalization**: Backend messages → user-friendly copy

**Critical Endpoints:**
```
POST   /rides                          → Create trip request (idempotent)
GET    /rides/current                  → Fetch active trip (recovery)
GET    /users/drivers/available?...    → List nearby drivers + transmission filter
GET    /locations/route?...            → Calculate distance/ETA
PATCH  /users/online                   → Toggle driver online status + broadcast location
POST   /payments/initiate/{tripId}     → Start Monnify checkout → redirect
GET    /payments/status/{tripId}       → Check payment status (polling endpoint)
```

#### **WebSocket Integration (Socket.io)**
**Namespace:** `/rides`  
**Auth:** Bearer token in `auth.token` parameter  
**Transports:** WebSocket only (no polling fallback)

**Driver → Server Events:**
```
driverregister { driverId }
driverlocation { driverId, lat, lng }
ride:accept { tripId }
```

**Server → Driver Events:**
```
ride:assigned / ride:request    → New ride offer
ride:cancelled { tripId, message }
ride:otp_regenerated { tripId, otp }
payment:updated { tripId, paymentStatus, amount, ... }
trip:completed
```

**Driver → Owner Events:**
```
owner:register { ownerId }
trackdriver { driverId }
ride:cancel { tripId }
```

**Server → Owner Events:**
```
ride:accepted { driver, estimatedArrivalMins, otp, ... }
ride:declined { message }
ride:progress { tripId, milestone: 'assigned'|'arrived'|'in_progress' }
trip:status { tripId, status, milestone, otp, acceptanceImageUrl }
payment:updated { tripId, paymentStatus, paidAt, amount, ... }
driver:availability
locationupdated { driverId, lat, lng }
```

#### **NotificationService.ts** (Firebase Cloud Messaging)
- Initializes on login
- FCM token synced: `PATCH /users/fcm-token { token, deviceType }`
- Auto-routing on push notification (300ms delay to prevent race):
  - `rideaccepted` / `otpregenerated` → `/owner/status`
  - `dispatchfailed` → `/owner`
  - `paymentreceived` → `/driver/awaiting-payment/{tripId}`
  - `ridecancelled` → home (role-appropriate)

---

## 🎯 Critical Hooks

#### **useRideManager.ts** (Trip Orchestration)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| `syncCurrentRide()` | GET /rides/current | Fetch active trip, restore state (protected by PROTECTED_STATES guard) |
| `fetchAvailableDrivers(pickup, transmission)` | GET /users/drivers/available | Get nearby drivers filtered by transmission |
| `getRoute(origin, dest)` | GET /locations/route | Calculate distance & ETA |
| `initiateRideRequest(...)` | POST /rides | Create trip request with idempotency key |
| `initiatePayment(tripId)` | POST /payments/initiate/{tripId} | Start Monnify checkout, store tripId in localStorage |
| `getPaymentStatus(tripId)` | GET /payments/status/{tripId} | Check payment status |
| `cancelRide(tripId)` | POST /rides/{tripId}/cancel | Cancel active trip |

**Key Pattern:** All methods return stable callback identity (wrapped in useCallback). Errors show toast.

#### **useDriverRealtime.ts** (Driver Real-Time Events)
**Responsibilities:**
- Manage WebSocket connection lifecycle
- Emit `driverregister` on connect
- Listen to incoming ride requests
- Boot-time sync to recover pending/active rides
- Broadcast driver location via `pushDriverLocation()`
- Handle `enableOnline()` / `disableOnline()`
- Detect permission errors, suspension, network failures

**Critical Method: `enableOnline()`**
```
1. Request GPS permission
   ├─ ✅ If granted → getCurrentLocation()
   │   └─ PATCH /users/online { isOnline: true, lat, lng }
   ├─ ⚠️ If denied → Show tooltip to enable in Settings
   └─ ⚠️ If timeout → No guard! Hangs indefinitely
2. If GPS fails → Fallback to go online without coords
3. Socket connects → driverregister + boot-time sync
```

**Risk:** NO TIMEOUT on getCurrentLocation → user can wait forever

#### **useOwnerRealtime.ts** (Owner Real-Time Events)
**Responsibilities:**
- Manage WebSocket connection for owner
- Listen for `ride:accepted` → show driver info + ETA
- Listen for milestone updates → trigger UI transitions
- Listen for `payment:updated` → trigger rating gate or navigate
- Listen for `locationupdated` → update driver position on map
- Handle app resume → reconnect socket + re-emit tracker

**Risk:** Callbacks use ref-based pattern with null guards MISSING in one place (locationupdated handler)

---

## 🔴 CRITICAL ISSUES (Must Fix)

### **1. Missing Null Guard in locationupdated Handler**
**File:** `src/hooks/useOwnerRealtime.ts` (line ~198)
```typescript
ownerSocketRef.current.on('locationupdated', (data: any) => {
  // ...
  onLocationUpdatedRef.current(data.lat, data.lng);  // ⚠️ CRASHES if null
});
```
**Fix:** Add optional chaining
```typescript
onLocationUpdatedRef.current?.(data.lat, data.lng);
```
**Impact:** One stale location update crashes the event listener → owner stops seeing live driver position

---

### **2. GPS Hang (No Timeout)**
**File:** `src/hooks/useDriverRealtime.ts` (line ~74)
```typescript
const pos = await CapacitorService.getCurrentLocation();  // ⚠️ NO TIMEOUT
```
**Fix:** Add timeout wrapper
```typescript
const pos = await Promise.race([
  CapacitorService.getCurrentLocation(),
  new Promise((_, reject) => setTimeout(() => reject(new Error('GPS timeout')), 5000))
]);
```
**Impact:** User taps "Go Online" and waits forever (until force-close)

---

### **3. Double Payment Success Handler**
**File:** `src/screens/PaymentCompleteScreen.tsx` (line ~104-115)
```typescript
// WebSocket listener
useOwnerRealtime({
  onPaymentUpdated: (payload) => {
    if (payload.paymentStatus === 'PAID') handleSuccess(payload);  // Call #1
  }
});

// Also polling
const data = await api.get(`/payments/status/${tripId}`);
if (data.paymentStatus === 'PAID') {
  handleSuccess(data);  // Call #2 (same 4.5s window)
}
```
**Fix:** Add idempotency flag
```typescript
const [handled, setHandled] = useState(false);
const handleSuccess = (data) => {
  if (handled) return;  // Prevent double-fire
  setHandled(true);
  // ... rest
};
```
**Impact:** Two navigations queued → React Router confusion → potential state corruption

---

### **4. Silent Boot-Time Sync Failure**
**File:** `src/hooks/useDriverRealtime.ts` (line ~164-180)
```typescript
const bootSync = async () => {
  try {
    const trip = await api.get<any>('/rides/current');
    // restore logic
  } catch (err) {
    console.warn('[DriverSync] Could not recover active ride:', err);
    // ⚠️ No callback! Driver thinks no trips waiting, but server has one
  }
};
```
**Fix:** Invoke fallback callback or retry with backoff
```typescript
} catch (err) {
  if (retries < 3) {
    setTimeout(() => bootSync(), Math.pow(2, retries) * 1000);
  } else {
    onRideProgress?.({ tripId: null, milestone: 'error' });  // Notify caller
  }
}
```
**Impact:** Driver offline state if boot-time sync fails once → lost ride request

---

### **5. Stale Socket Auth Token**
**File:** `src/hooks/useDriverRealtime.ts` (line ~103-104)
```typescript
socketRef.current = io(`${API_URL}/rides`, {
  auth: { token: localStorage.getItem('bica_token') }
});
```
**Problem:** If access token refreshes (401 → refresh → new token), socket keeps old token
**Fix:** Re-authenticate on token refresh
```typescript
// Monitor token changes
useEffect(() => {
  const token = localStorage.getItem('bica_token');
  if (socketRef.current?.auth) {
    socketRef.current.auth = { token };  // Update auth
    socketRef.current.disconnect();
    socketRef.current.connect();  // Reconnect with new token
  }
}, []);  // Trigger when token changes
```
**Impact:** Driver location broadcasts fail silently after token refresh → appears offline to owners

---

### **6. Race Condition in syncCurrentRide**
**File:** `src/hooks/useRideManager.ts` (line ~59-69)
```typescript
const { rideState: currentState } = useRideStore.getState();  // Read HERE
// ... async API call
if (!PROTECTED_STATES.includes(currentState)) {  // Check with STALE value
  resetRide();
}
```
**Problem:** State can change between read and use
**Fix:** Re-read state after fetch
```typescript
const { rideState: currentState } = useRideStore.getState();
const trip = await api.get<any>('/rides/current');
const { rideState: latestState } = useRideStore.getState();  // Re-read
if (!PROTECTED_STATES.includes(latestState)) {
  resetRide();
}
```
**Impact:** Inconsistent local/server state, showing wrong trip

---

## 🟡 HIGH-PRIORITY ISSUES

### **7. Payment Polling API Spike**
**Location:** PaymentCompleteScreen + AwaitingPaymentScreen
- Both poll `/payments/status` every 2.5-5 seconds for 2-10 minutes
- Example: 100 users completing payment = ~2400-4800 requests in 10 min
- Could trigger API rate limiting (429) → throttle cooldown → failed payments

**Fix:** Add exponential backoff + jitter
```typescript
const interval = Math.min(1000 * Math.pow(1.5, pollCount), 30000);  // Cap at 30s
const jitter = Math.random() * 1000;
intervalRef.current = setInterval(poll, interval + jitter);
```

---

### **8. No Retry for Location Persistence**
**File:** `src/hooks/useDriverRealtime.ts` (line ~127-145)
```typescript
await api.patch('/users/location', { lat: latitude, lng: longitude });
// If network failure, location lost forever
```
**Fix:** Queue + retry
```typescript
const failedLocationUpdates: Array<[number, number]> = [];
try {
  await api.patch('/users/location', { lat, lng });
} catch (error) {
  failedLocationUpdates.push([lat, lng]);  // Queue
  // Retry next broadcast
}
```

---

### **9. No Abort Controller on Location Search**
**File:** `src/services/LocationService.ts` + `useOwnerLocationSearch.ts`
```typescript
async search(query, ..., signal?: AbortSignal) {
  // Uses signal if provided, but no creation of AbortController if not
  // Can leak requests if component unmounts mid-search
}
```
**Fix:** Create scoped abort in hook
```typescript
const abortControllerRef = useRef<AbortController | null>(null);
useEffect(() => {
  return () => {
    abortControllerRef.current?.abort();
  };
}, []);
// Pass to all search calls
```

---

### **10. Missing Route Response Validation**
**File:** `src/hooks/useRideManager.ts` (line ~105-115)
```typescript
const route = await api.get<any>(`/locations/route?...`);
setRoutePreview({
  distanceKm: route.distanceKm,  // ⚠️ Assumes exists
  estimatedMins: route.estimatedMins
});
```
**Fix:** Validate before setting
```typescript
if (!route?.distanceKm || !route?.estimatedMins) {
  throw new Error(`Invalid route response: ${JSON.stringify(route)}`);
}
```

---

## 📊 Data Flow Diagram

```
OWNER REQUEST FLOW:
────────────────────

RequestRideScreen
    ↓ (SELECT DRIVER)
    ├─ Location.search (GET /locations/search)  ←─ [Abort on unmount?] ❌
    ├─ Route calculation (GET /locations/route)
    └─ Driver list (GET /users/drivers/available)
    
    ↓ (SUBMIT REQUEST)
    → POST /rides (idempotent ✅)
    
    ↓ (WAIT FOR ACCEPTANCE)
    ← Socket: ride:accepted
    ← Socket: ride:declined (go back to driver picker)
    
    ↓ (ACCEPTED)
    → Navigate to TripStatusScreen
    → Set state: ASSIGNED
    
    ↓ (IN PROGRESS)
    ← Socket: ride:progress { milestone: 'arrived' }
    ← Socket: ride:progress { milestone: 'in_progress' }
    ← Socket: locationupdated (update driver map marker) [CRASH RISK ❌]
    
    ↓ (COMPLETED)
    ← Socket: trip:completed
    → Navigate to PaymentCompleteScreen
    
    ↓ (PAYMENT VERIFICATION)
    → GET /payments/status/{tripId} [Poll every 2.5s × 48 = 2 min]
    ← Socket: payment:updated [Real-time]
    [RACE: Both may fire ❌]
    
    ↓ (PAID)
    → Check pending rating (useRatingGateStore)
    → Navigate to RateDriverScreen or Dashboard


DRIVER ONLINE FLOW:
───────────────────

DriverMainScreen
    ↓ (TAP "GO ONLINE")
    → enableOnline()
        ├─ Request GPS permission
        ├─ CapacitorService.getCurrentLocation() [NO TIMEOUT ❌]
        └─ PATCH /users/online { isOnline: true, lat, lng }
    
    ↓ (SOCKET CONNECTED)
    → emit: driverregister { driverId }
    → Boot-time sync: GET /rides/current [SILENT FAIL ❌]
    
    ↓ (LISTENING FOR REQUESTS)
    ← Socket: ride:assigned / ride:request
    → Display live request cards
    
    ↓ (DRIVER ACCEPTS)
    → POST /rides/{tripId}/accept OR implicit via socket
    
    ↓ (NAVIGATING TO PICKUP)
    → Every ~10s: pushDriverLocation()
        ├─ Local: setDriverPos()
        ├─ API: PATCH /users/location { lat, lng } [NO RETRY ❌]
        └─ Socket: emit driverlocation
    ← Socket: locationupdated (owner map marker) [OTHER SIDE]
    
    ↓ (AT PICKUP - VERIFY OTP)
    ← Socket: ride:otp_regenerated [From FCM or direct]
    
    ↓ (IN PROGRESS)
    → Continue broadcasting location
    ← Socket: trip:completed
    
    ↓ (PAYMENT WAIT)
    → Navigate to AwaitingPaymentScreen
    → GET /payments/status/{tripId} [Poll every 5s × 120 = 10 min]
    ← Socket: payment:updated
    [RACE: Both may fire ❌]
    
    ↓ (PAID)
    → Navigate back to DriverActivityScreen
```

---

## 🛡️ Recommended Fixes (Priority Order)

| Issue | Priority | Effort | Impact |
|-------|----------|--------|--------|
| Callback null guard (Issue #1) | 🔴 Critical | 5m | Prevents crash |
| GPS timeout (Issue #2) | 🔴 Critical | 15m | Prevents hang |
| Payment idempotency (Issue #3) | 🔴 Critical | 20m | Prevents double nav |
| Boot-time sync (Issue #4) | 🟡 High | 30m | Prevents lost rides |
| Socket token refresh (Issue #5) | 🟡 High | 45m | Prevents stale auth |
| Payment polling backoff (Issue #7) | 🟡 High | 25m | Prevents API spike |
| Location persist retry (Issue #8) | 🟡 High | 30m | Prevents stale position |
| Abort controller (Issue #9) | 🟠 Medium | 40m | Prevents memory leak |
| Route validation (Issue #10) | 🟠 Medium | 15m | Prevents NaN state |

---

## 📚 Architecture Summary

**State Layer:** Zustand stores (rideStore, authStore, connectivityStore)
**Service Layer:** api.service, LocationService, NotificationService, CapacitorService
**Hook Layer:** useRideManager, useDriverRealtime, useOwnerRealtime, useOwnerLocationSearch
**Transport Layer:** REST (api.service) + WebSocket (socket.io) for real-time
**Persistence:** localForage (browser storage) + localStorage (tokens)
**Payment:** Monnify (external provider) with polling fallback
**Push Notifications:** Firebase Cloud Messaging + WebSocket

**Strengths:**
- ✅ Idempotent requests (safe retries)
- ✅ Token auto-refresh
- ✅ Real-time WebSocket updates
- ✅ Dual polling + WebSocket fallback for critical flows
- ✅ Session identity validation

**Weaknesses:**
- ❌ Missing callback null guards
- ❌ No timeout on GPS/location requests
- ❌ Silent failures in boot-time sync
- ❌ Stale socket auth after token refresh
- ❌ Double success handler possibility
- ❌ No retry on location persistence failures
- ❌ Unbounded search request cleanup
- ❌ Poor API polling strategy (no backoff)
