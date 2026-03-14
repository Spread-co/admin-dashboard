<template>
  <div v-if="!content.portalTarget || content.portalTarget === 'admin'" class="spread-ad">
    <div v-if="permissionGranted !== true" class="spread-perm-overlay" style="position:absolute;inset:0;z-index:9999;background:var(--spread-cream,#FBFAF8);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:32px;text-align:center;">
      <div v-if="permissionGranted === null" style="width:24px;height:24px;border:3px solid rgba(0,0,0,0.1);border-top-color:var(--spread-accent,#CE6632);border-radius:50%;animation:spread-perm-spin 0.7s linear infinite;"></div>
      <template v-else>
        <span style="font-size:32px;line-height:1;">🔒</span>
        <strong style="font-size:15px;font-weight:700;color:var(--spread-black,#141414);margin:0;">Access denied</strong>
        <span style="font-size:13px;color:var(--spread-mid-grey,#6B7280);">You don't have permission to view this area.</span>
      </template>
    </div>
    <!-- Header -->
    <div class="spread-ad__header">
      <h2 class="spread-ad__title">Dashboard</h2>
      <button class="spread-ad__btn spread-ad__btn--outline" :disabled="loading" @click="loadAll">
        <span v-if="loading" class="spread-ad__spinner"></span>
        <span v-else>↻ Refresh</span>
      </button>
    </div>

    <!-- ============================================================ -->
    <!--  KPI cards                                                    -->
    <!-- ============================================================ -->
    <section class="spread-ad__section">
      <div class="spread-ad__kpi-row">
        <div v-for="kpi in kpiCards" :key="kpi.key" class="spread-ad__kpi-card">
          <span class="spread-ad__kpi-label">{{ kpi.label }}</span>
          <span class="spread-ad__kpi-value" :class="kpi.cls">{{ kpi.display }}</span>
        </div>
      </div>
    </section>

    <!-- ============================================================ -->
    <!--  Order funnel (CSS-only bars)                                 -->
    <!-- ============================================================ -->
    <section class="spread-ad__section">
      <h3 class="spread-ad__section-title">Order Funnel <span class="spread-ad__section-sub">(30 days)</span></h3>
      <div v-if="funnelData" class="spread-ad__funnel">
        <div v-for="step in funnelSteps" :key="step.key" class="spread-ad__funnel-row">
          <span class="spread-ad__funnel-label">{{ step.label }}</span>
          <div class="spread-ad__funnel-bar-bg">
            <div
              class="spread-ad__funnel-bar-fill"
              :style="{ width: step.pct + '%', background: step.color }"
            ></div>
          </div>
          <span class="spread-ad__funnel-val">{{ step.value }}</span>
        </div>
        <div class="spread-ad__funnel-conv">
          Conversion: <strong>{{ funnelData.conversion_pct || 0 }}%</strong>
        </div>
      </div>
      <div v-else class="spread-ad__placeholder">No funnel data available</div>
    </section>

    <!-- ============================================================ -->
    <!--  Capacity heatmap cards (read-only)                           -->
    <!-- ============================================================ -->
    <section class="spread-ad__section">
      <h3 class="spread-ad__section-title">Region Capacity</h3>
      <div v-if="capacityData.length" class="spread-ad__cap-grid">
        <div
          v-for="r in capacityData"
          :key="r.region_id"
          class="spread-ad__cap-card"
          :class="'spread-ad__cap-card--' + r.status_indicator"
        >
          <span class="spread-ad__cap-name">{{ r.region_name }}</span>
          <span class="spread-ad__cap-pct">{{ r.consumption_pct }}%</span>
          <div class="spread-ad__cap-bar-bg">
            <div
              class="spread-ad__cap-bar-fill"
              :class="'spread-ad__cap-bar-fill--' + r.status_indicator"
              :style="{ width: Math.min(r.consumption_pct, 100) + '%' }"
            ></div>
          </div>
          <span class="spread-ad__cap-detail">{{ r.current_households }}/{{ r.max_capacity || '∞' }}</span>
        </div>
      </div>
      <div v-else class="spread-ad__placeholder">No capacity data</div>
    </section>

    <!-- ============================================================ -->
    <!--  Product sync status                                          -->
    <!-- ============================================================ -->
    <section class="spread-ad__section">
      <h3 class="spread-ad__section-title">Product Sync Status</h3>
      <div v-if="syncData.length" class="spread-ad__sync-table-wrap">
        <table class="spread-ad__sync-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Status</th>
              <th>Synced</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in syncData" :key="s.product_id">
              <td>{{ s.product_name }}</td>
              <td>
                <span
                  class="spread-ad__sync-badge"
                  :class="s.in_sync ? 'spread-ad__sync-badge--ok' : 'spread-ad__sync-badge--err'"
                >
                  {{ s.in_sync ? 'In Sync' : 'Out of Sync' }}
                </span>
              </td>
              <td>{{ formatTime(s.synced_at) }}</td>
              <td>{{ s.last_error || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="spread-ad__placeholder">No product sync data</div>
    </section>

    <!-- ============================================================ -->
    <!--  Region usage (latest cycle)                                  -->
    <!-- ============================================================ -->
    <section class="spread-ad__section">
      <h3 class="spread-ad__section-title">Region Usage <span class="spread-ad__section-sub">(latest cycle)</span></h3>
      <div v-if="regionUsage.length" class="spread-ad__usage-grid">
        <div v-for="u in regionUsage" :key="u.region_id" class="spread-ad__usage-card">
          <span class="spread-ad__usage-region">{{ u.region_name }}</span>
          <span class="spread-ad__usage-cycle">{{ u.cycle_name }}</span>
          <div class="spread-ad__usage-stats">
            <span><strong>{{ u.orders_count }}</strong> orders</span>
            <span><strong>{{ u.unique_households }}</strong> households</span>
          </div>
        </div>
      </div>
      <div v-else class="spread-ad__placeholder">No usage data</div>
    </section>
  </div>
</template>

<script>
/* ------------------------------------------------------------------ */
/*  Inline Supabase client                                            */
/* ------------------------------------------------------------------ */
function createSpreadClient(url, anonKey, token) {
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${token || anonKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  return {
    async rpc(fnName, params = {}) {
      const res = await fetch(`${url}/rest/v1/rpc/${fnName}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw Object.assign(new Error(e.message || res.statusText), { status: res.status, code: e.code });
      }
      return res.json();
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Editor mock data                                                  */
/* ------------------------------------------------------------------ */
const MOCK_KPIS = { active_members: 312, orders_today: 27, revenue_mtd: 1843500, capacity_avg_pct: 64 };

const MOCK_FUNNEL = [
  { date: '2026-03-12', carts_created: 120, checkouts_started: 88, orders_completed: 72, orders_cancelled: 5, conversion_pct: 60 },
];

const MOCK_CAPACITY = [
  { region_id: 'r1', region_name: 'Sydney Metro', current_households: 45, max_capacity: 100, consumption_pct: 45, status_indicator: 'green' },
  { region_id: 'r2', region_name: 'Melbourne CBD', current_households: 78, max_capacity: 100, consumption_pct: 78, status_indicator: 'amber' },
  { region_id: 'r3', region_name: 'Brisbane North', current_households: 93, max_capacity: 100, consumption_pct: 93, status_indicator: 'red' },
  { region_id: 'r4', region_name: 'Perth Metro', current_households: 12, max_capacity: 0, consumption_pct: 0, status_indicator: 'uncapped' },
];

const MOCK_SYNC = [
  { product_id: 'p1', product_name: 'Weekly Box — Small', in_sync: true, synced_at: '2026-03-12T10:00:00Z', last_error: null },
  { product_id: 'p2', product_name: 'Weekly Box — Family', in_sync: false, synced_at: '2026-03-11T09:00:00Z', last_error: 'Price mismatch' },
];

const MOCK_USAGE = [
  { region_id: 'r1', region_name: 'Sydney Metro', cycle_name: 'Week 11', orders_count: 87, unique_households: 62 },
  { region_id: 'r2', region_name: 'Melbourne CBD', cycle_name: 'Week 11', orders_count: 64, unique_households: 51 },
];

export default {
  props: {
    /* wwEditor:start */
    wwEditorState: { type: Object, required: true },
    /* wwEditor:end */
    content: { type: Object, required: true },
    wwFrontState: { type: Object, required: true },
    wwElementState: { type: Object, required: true },
  },
  emits: ['trigger-event', 'update:content'],

  setup() {
    const { value: wwSections, setValue: setWwSections } =
      wwLib.wwVariable.useComponentVariable({
        uid: 'sectionsLoaded',
        name: 'Sections Loaded',
        type: 'number',
        defaultValue: 0,
      });
    return { wwSections, setWwSections };
  },

  data() {
    return {
      permissionGranted: null,
      loading: false,
      kpis: null,
      funnelRaw: [],
      capacityData: [],
      syncData: [],
      regionUsage: [],
    };
  },

  computed: {
    isEditorMode() {
      /* wwEditor:start */
      return !!this.wwEditorState;
      /* wwEditor:end */
      return false; // eslint-disable-line no-unreachable
    },

    kpiCards() {
      const k = this.kpis || {};
      return [
        { key: 'members', label: 'Active Members', display: this.fmtNum(k.active_members ?? 0), cls: '' },
        { key: 'orders', label: 'Orders Today', display: this.fmtNum(k.orders_today ?? 0), cls: '' },
        { key: 'revenue', label: 'Revenue MTD', display: this.fmtCurrency(k.revenue_mtd ?? 0), cls: 'spread-ad__kpi-value--revenue' },
        { key: 'capacity', label: 'Avg Capacity', display: (k.capacity_avg_pct ?? 0) + '%', cls: this.capacityCls(k.capacity_avg_pct ?? 0) },
      ];
    },

    funnelData() {
      if (!this.funnelRaw.length) return null;
      // Aggregate across all returned rows (RPC returns 30d rolling, may have multiple rows)
      return this.funnelRaw.reduce(
        (acc, r) => {
          acc.carts_created += r.carts_created || 0;
          acc.checkouts_started += r.checkouts_started || 0;
          acc.orders_completed += r.orders_completed || 0;
          acc.orders_cancelled += r.orders_cancelled || 0;
          return acc;
        },
        { carts_created: 0, checkouts_started: 0, orders_completed: 0, orders_cancelled: 0, conversion_pct: this.funnelRaw[this.funnelRaw.length - 1]?.conversion_pct || 0 }
      );
    },

    funnelSteps() {
      const f = this.funnelData;
      if (!f) return [];
      const max = Math.max(f.carts_created, 1);
      return [
        { key: 'carts', label: 'Carts Created', value: f.carts_created, pct: 100, color: 'var(--spread-info)' },
        { key: 'checkouts', label: 'Checkouts Started', value: f.checkouts_started, pct: Math.round((f.checkouts_started / max) * 100), color: '#8B5CF6' },
        { key: 'completed', label: 'Orders Completed', value: f.orders_completed, pct: Math.round((f.orders_completed / max) * 100), color: 'var(--spread-success)' },
        { key: 'cancelled', label: 'Cancelled', value: f.orders_cancelled, pct: Math.round((f.orders_cancelled / max) * 100), color: 'var(--spread-error)' },
      ];
    },
  },

  watch: {
    'content.refreshTrigger'() {
      this.loadAll();
    },
    'content.accessToken': { immediate: true, handler(token) { if (token) this.checkAdminPermission(); else this.permissionGranted = false; } },
  },

  mounted() {
    this.loadAll();
  },

  methods: {
    async checkAdminPermission() {
      const t = this.content?.accessToken, u = this.content?.userId,
            url = this.content?.supabaseUrl, k = this.content?.supabaseAnonKey;
      if (!t || !u || !url || !k) { this.permissionGranted = false; return; }
      try {
        const ALLOWED = ['founder', 'platform_admin', 'regional_manager', 'country_manager'];
        const results = await Promise.all(ALLOWED.map(role =>
          fetch(`${url}/rest/v1/rpc/has_role`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: k, Authorization: `Bearer ${t}` },
            body: JSON.stringify({ p_user_id: u, p_role_key: role }),
          }).then(r => r.ok ? r.json() : false)
        ));
        this.permissionGranted = results.some(Boolean);
      } catch { this.permissionGranted = false; }
    },

    client() {
      return createSpreadClient(
        this.content?.supabaseUrl,
        this.content?.supabaseAnonKey,
        this.content?.accessToken
      );
    },

    fmtNum(n) {
      return Number(n).toLocaleString('en-AU');
    },

    fmtCurrency(cents) {
      return '$' + (Number(cents) / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    capacityCls(pct) {
      if (pct >= 90) return 'spread-ad__kpi-value--red';
      if (pct >= 70) return 'spread-ad__kpi-value--amber';
      return 'spread-ad__kpi-value--green';
    },

    formatTime(iso) {
      if (!iso) return '—';
      try {
        return new Date(iso).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' });
      } catch {
        return iso;
      }
    },

    async loadAll() {
      /* wwEditor:start */
      if (this.isEditorMode) {
        this.kpis = MOCK_KPIS;
        this.funnelRaw = MOCK_FUNNEL;
        this.capacityData = MOCK_CAPACITY;
        this.syncData = MOCK_SYNC;
        this.regionUsage = MOCK_USAGE;
        this.setWwSections(5);
        return;
      }
      /* wwEditor:end */

      this.loading = true;
      let loaded = 0;
      const c = this.client();

      // Fire all 5 RPCs in parallel
      const [kpiRes, funnelRes, capRes, syncRes, usageRes] = await Promise.allSettled([
        c.rpc('get_admin_dashboard_kpis'),
        c.rpc('get_admin_order_funnel'),
        c.rpc('get_admin_capacity_consumption'),
        c.rpc('get_admin_product_sync_status'),
        c.rpc('get_admin_region_usage', { p_limit: 20 }),
      ]);

      // KPIs
      if (kpiRes.status === 'fulfilled') {
        this.kpis = kpiRes.value;
        loaded++;
      } else {
        this.emitError(kpiRes.reason?.message || 'KPI load failed');
      }

      // Funnel
      if (funnelRes.status === 'fulfilled') {
        this.funnelRaw = Array.isArray(funnelRes.value) ? funnelRes.value : [];
        loaded++;
      } else {
        this.emitError(funnelRes.reason?.message || 'Funnel load failed');
      }

      // Capacity
      if (capRes.status === 'fulfilled') {
        this.capacityData = Array.isArray(capRes.value) ? capRes.value : [];
        loaded++;
      } else {
        this.emitError(capRes.reason?.message || 'Capacity load failed');
      }

      // Sync
      if (syncRes.status === 'fulfilled') {
        this.syncData = Array.isArray(syncRes.value) ? syncRes.value : [];
        loaded++;
      } else {
        this.emitError(syncRes.reason?.message || 'Sync status load failed');
      }

      // Usage
      if (usageRes.status === 'fulfilled') {
        this.regionUsage = Array.isArray(usageRes.value) ? usageRes.value : [];
        loaded++;
      } else {
        this.emitError(usageRes.reason?.message || 'Region usage load failed');
      }

      this.setWwSections(loaded);
      this.$emit('trigger-event', {
        name: 'admindashboard:loaded',
        event: { sections: `${loaded}/5` },
      });
      this.loading = false;
    },

    emitError(msg) {
      this.$emit('trigger-event', {
        name: 'admindashboard:error',
        event: { message: msg },
      });
    },
  },
};
</script>

<style scoped>
/* ------------------------------------------------------------------ */
/*  Design tokens                                                     */
/* ------------------------------------------------------------------ */
.spread-ad {
  --spread-primary: #4B162D;
  --spread-accent: #CE6632;
  --spread-accent-hover: #B5572B;
  --spread-cream: #FBFAF8;
  --spread-black: #141414;
  --spread-dark-grey: #2B2B2B;
  --spread-mid-grey: #4B5563;
  --spread-light-grey: #6B7280;
  --spread-border: #E5E7EB;
  --spread-border: #F3EADF;
  --spread-border-outer: #EFE7DE;
  --spread-error: #D14343;
  --spread-success: #16A34A;
  --spread-warning: #D97706;
  --spread-info: #2563EB;
  --spread-radius: 12px;
  --spread-radius-lg: 16px;

  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: var(--spread-black);
  max-width: 1440px;
  margin: 0 auto;
  padding: 24px;
  position: relative;
}

/* ---- Header ---- */
.spread-ad__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.spread-ad__title {
  font-size: 22px;
  font-weight: 900;
  color: var(--spread-primary);
  margin: 0;
  line-height: 1.25;
}

/* ---- Section ---- */
.spread-ad__section {
  margin-bottom: 32px;
}

.spread-ad__section-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--spread-primary);
  margin: 0 0 14px;
}

.spread-ad__section-sub {
  font-weight: 400;
  color: var(--spread-mid-grey);
  font-size: 13px;
}

.spread-ad__placeholder {
  padding: 32px 16px;
  text-align: center;
  color: var(--spread-mid-grey);
  background: var(--spread-cream);
  border: 1px solid var(--spread-border);
  border-radius: var(--spread-radius);
  font-size: 14px;
}

/* ================================================================== */
/*  KPI cards                                                         */
/* ================================================================== */
.spread-ad__kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

@media (max-width: 1023px) {
  .spread-ad__kpi-row { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 479px) {
  .spread-ad__kpi-row { grid-template-columns: 1fr; }
}

.spread-ad__kpi-card {
  background: #fff;
  border: 1px solid var(--spread-border-outer);
  border-radius: var(--spread-radius-lg);
  padding: 20px;
  text-align: center;
}

.spread-ad__kpi-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--spread-mid-grey);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  margin-bottom: 8px;
}

.spread-ad__kpi-value {
  display: block;
  font-size: 28px;
  font-weight: 900;
  color: var(--spread-black);
  line-height: 1.15;
}

.spread-ad__kpi-value--revenue { color: var(--spread-primary); }
.spread-ad__kpi-value--green { color: var(--spread-success); }
.spread-ad__kpi-value--amber { color: var(--spread-warning); }
.spread-ad__kpi-value--red { color: var(--spread-error); }

/* ================================================================== */
/*  Order funnel                                                      */
/* ================================================================== */
.spread-ad__funnel { max-width: 600px; }

.spread-ad__funnel-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.spread-ad__funnel-label {
  width: 140px;
  font-size: 13px;
  font-weight: 600;
  color: var(--spread-dark-grey);
  flex-shrink: 0;
}

.spread-ad__funnel-bar-bg {
  flex: 1;
  height: 14px;
  background: var(--spread-border);
  border-radius: 7px;
  overflow: hidden;
}

.spread-ad__funnel-bar-fill {
  height: 100%;
  border-radius: 7px;
  transition: width 0.4s ease;
}

.spread-ad__funnel-val {
  width: 50px;
  text-align: right;
  font-size: 13px;
  font-weight: 700;
  color: var(--spread-dark-grey);
}

.spread-ad__funnel-conv {
  margin-top: 10px;
  font-size: 13px;
  color: var(--spread-mid-grey);
}

/* ================================================================== */
/*  Capacity heatmap cards                                             */
/* ================================================================== */
.spread-ad__cap-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

@media (max-width: 1023px) {
  .spread-ad__cap-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 479px) {
  .spread-ad__cap-grid { grid-template-columns: 1fr; }
}

.spread-ad__cap-card {
  background: #fff;
  border: 1px solid var(--spread-border-outer);
  border-radius: var(--spread-radius);
  padding: 14px;
}

.spread-ad__cap-card--green  { border-left: 3px solid var(--spread-success); }
.spread-ad__cap-card--amber  { border-left: 3px solid var(--spread-warning); }
.spread-ad__cap-card--red    { border-left: 3px solid var(--spread-error); }
.spread-ad__cap-card--uncapped { border-left: 3px solid var(--spread-info); }

.spread-ad__cap-name {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: var(--spread-black);
  margin-bottom: 4px;
}

.spread-ad__cap-pct {
  display: block;
  font-size: 20px;
  font-weight: 900;
  color: var(--spread-dark-grey);
  margin-bottom: 8px;
}

.spread-ad__cap-bar-bg {
  height: 6px;
  background: var(--spread-border);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
}

.spread-ad__cap-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}

.spread-ad__cap-bar-fill--green   { background: var(--spread-success); }
.spread-ad__cap-bar-fill--amber   { background: var(--spread-warning); }
.spread-ad__cap-bar-fill--red     { background: var(--spread-error); }
.spread-ad__cap-bar-fill--uncapped { background: var(--spread-info); }

.spread-ad__cap-detail {
  font-size: 11px;
  color: var(--spread-mid-grey);
}

/* ================================================================== */
/*  Product sync table                                                 */
/* ================================================================== */
.spread-ad__sync-table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.spread-ad__sync-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.spread-ad__sync-table th,
.spread-ad__sync-table td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid var(--spread-border);
}

.spread-ad__sync-table th {
  font-weight: 700;
  color: var(--spread-mid-grey);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  background: var(--spread-cream);
}

.spread-ad__sync-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
}

.spread-ad__sync-badge--ok {
  background: #dcfce7;
  color: var(--spread-success);
}

.spread-ad__sync-badge--err {
  background: #fee2e2;
  color: var(--spread-error);
}

/* ================================================================== */
/*  Region usage cards                                                 */
/* ================================================================== */
.spread-ad__usage-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

@media (max-width: 1023px) {
  .spread-ad__usage-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 767px) {
  .spread-ad__usage-grid { grid-template-columns: 1fr; }
}

.spread-ad__usage-card {
  background: #fff;
  border: 1px solid var(--spread-border-outer);
  border-radius: var(--spread-radius);
  padding: 14px;
}

.spread-ad__usage-region {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: var(--spread-black);
}

.spread-ad__usage-cycle {
  display: block;
  font-size: 12px;
  color: var(--spread-mid-grey);
  margin-bottom: 8px;
}

.spread-ad__usage-stats {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--spread-dark-grey);
}

/* ---- Buttons ---- */
.spread-ad__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: var(--spread-radius);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  border: none;
}

.spread-ad__btn--outline {
  background: #fff;
  color: var(--spread-accent);
  border: 1px solid var(--spread-accent);
}

.spread-ad__btn--outline:hover:not(:disabled) {
  background: #fdf4ef;
}

.spread-ad__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ---- Spinner ---- */
.spread-ad__spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--spread-border);
  border-top-color: var(--spread-accent);
  border-radius: 50%;
  animation: spread-ad-spin 0.6s linear infinite;
  display: inline-block;
}

@keyframes spread-ad-spin {
  to { transform: rotate(360deg); }
}
@media (min-width: 480px) {
  .spread-ad { padding: 16px 20px; }
}
@media (min-width: 1024px) {
  .spread-ad { padding: 20px 28px; }
}
@media (min-width: 1280px) {
  .spread-ad { padding: 24px 40px; }
}
@keyframes spread-perm-spin { to { transform: rotate(360deg); } }
</style>
