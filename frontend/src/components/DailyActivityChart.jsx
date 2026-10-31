import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import "./DailyActivityChart.css";

const STATUSES = [
  { key: "approved", label: "Approved", color: "#10b981" },
  { key: "pending", label: "Pending", color: "#f59e0b" },
  { key: "reAnalyze", label: "Re-Analyze", color: "#f43f5e" },
  { key: "rejected", label: "Rejected", color: "#991b1b" },
];

function ActivityTooltip({ active, payload }) {
  const day = payload?.[0]?.payload;
  if (!active || !day?.maximum) return null;
  return <div className="daily-activity-tooltip">
    <p>{day.date}</p>
    {STATUSES.map(status => <div key={status.key} style={{ color: status.color }}>{status.label} : {Number(day[status.key] || 0)}</div>)}
  </div>;
}

export default function DailyActivityChart({ data = [], loading = false, error = "" }) {
  const chartData = data.map(day => ({ ...day, total: STATUSES.reduce((sum, status) => sum + Number(day[status.key] || 0), 0), maximum: Math.max(0, ...STATUSES.map(status => Number(day[status.key] || 0))) }));
  const visibleStatuses = STATUSES.filter(status => data.some(day => Number(day[status.key]) > 0));
  if (loading) return <div className="daily-activity-message" role="status">Loading daily activity...</div>;
  if (error) return <div className="daily-activity-message" role="alert">{error}</div>;
  return <div className="daily-activity-chart"><ResponsiveContainer width="100%" height={260}>
    <BarChart data={chartData} barCategoryGap="10%" margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
      <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#edf2f7" />
      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
      <YAxis allowDecimals={false} tickCount={5} domain={[0, maximum => Math.max(4, Math.ceil(maximum))]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
      <Tooltip content={<ActivityTooltip />} cursor={{ fill: "#ccc" }} />
      <Bar dataKey="total" name="Total Bids" fill="#2563eb" maxBarSize={44} isAnimationActive={false} />
    </BarChart>
  </ResponsiveContainer>
    {!visibleStatuses.length && <p className="daily-activity-empty">No bid activity this week for this selection.</p>}
    <div className="daily-activity-legend">{STATUSES.map(status => <span key={status.key} style={{ color: status.color }}><i style={{ background: status.color }} />{status.label}</span>)}</div>
  </div>;
}
