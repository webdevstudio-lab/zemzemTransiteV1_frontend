import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  Plus,
  Wallet,
  BarChart3,
  TrendingUp,
  Calendar,
  Trash2,
  Edit3,
  ChevronDown,
  X,
  Layers,
} from "lucide-react";
import API from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";

const T = {
  accent: "#E11D48",
  accentMuted: "#FFF1F2",
  ink: "#0F172A",
  inkMid: "#475569",
  inkLight: "#94A3B8",
  surface: "#FFFFFF",
  surfaceAlt: "#F8FAFC",
  border: "#E2E8F0",
  borderLight: "#F1F5F9",
};

const moisNoms = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const useCountUp = (target, duration = 700) => {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    if (target === null || target === undefined) return;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
};

const KpiCard = ({ label, value, sub, icon: Icon, accent, delay = 0 }) => {
  const animated = useCountUp(value ?? 0, 800);
  return (
    <div className="dep-kpi" style={{ animationDelay: `${delay}ms` }}>
      <div className="dep-kpi-top">
        <span className="dep-kpi-label">{label}</span>
        <div
          className="dep-kpi-icon"
          style={{ color: accent, background: accent + "18" }}
        >
          <Icon size={15} strokeWidth={2.5} />
        </div>
      </div>
      <div className="dep-kpi-value">
        {value !== null ? (
          <>
            {animated.toLocaleString("fr-FR")}
            <span className="dep-kpi-cur">MRU</span>
          </>
        ) : (
          <span className="dep-kpi-na">—</span>
        )}
      </div>
      <div className="dep-kpi-sub">{sub}</div>
    </div>
  );
};

const Toggle = ({ value, onChange, options }) => (
  <div className="dep-toggle">
    {options.map((o) => (
      <button
        key={o.value}
        className={`dep-toggle-btn${value === o.value ? " active" : ""}`}
        onClick={() => onChange(o.value)}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const Depenses = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ depenses: [], categories: [] });
  const [stats, setStats] = useState({
    mensuel: { depenses: 0, beneficeBrut: 0, beneficeReel: 0 },
    annuel: { depenses: 0, beneficeBrut: 0, beneficeReel: 0 },
  });
  const [viewMode, setViewMode] = useState("mois");
  const [filter, setFilter] = useState({
    mois: new Date().getMonth(),
    annee: new Date().getFullYear(),
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedCats, setExpandedCats] = useState({});
  const [form, setForm] = useState({
    description: "",
    montant: "",
    id_categorieDepense: "",
    date: new Date().toISOString().split("T")[0],
  });

  const loadPageData = useCallback(async () => {
    setLoading(true);
    try {
      const params =
        viewMode === "mois"
          ? { mois: filter.mois, annee: filter.annee }
          : { annee: filter.annee };
      const [resList, resCat, resStats] = await Promise.all([
        API.get(API_PATHS.DEPENSES.GET_ALL_DEPENSES),
        API.get(API_PATHS.CATDEPENSE.GET_ALL_CATDEPENSE),
        API.get(API_PATHS.DEPENSES.GET_DEPENSE_STATS, { params }),
      ]);
      setData({
        depenses: resList.data?.data || [],
        categories: resCat.data?.data || [],
      });
      if (resStats.data?.data) setStats(resStats.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter, viewMode]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const groupedDepenses = useMemo(() => {
    const filtered = data.depenses.filter((d) => {
      const dDate = new Date(d.date);
      if (viewMode === "annee") return dDate.getFullYear() === filter.annee;
      return (
        dDate.getMonth() === filter.mois && dDate.getFullYear() === filter.annee
      );
    });
    return filtered.reduce((acc, dep) => {
      const catName = dep.id_categorieDepense?.nom || "Non classé";
      if (!acc[catName]) acc[catName] = { list: [], total: 0 };
      acc[catName].list.push(dep);
      acc[catName].total += dep.montant;
      return acc;
    }, {});
  }, [data.depenses, filter, viewMode]);

  const totalDepenses = useMemo(
    () => Object.values(groupedDepenses).reduce((s, c) => s + c.total, 0),
    [groupedDepenses],
  );
  const totalEntries = useMemo(
    () => Object.values(groupedDepenses).reduce((s, c) => s + c.list.length, 0),
    [groupedDepenses],
  );

  const periodeLabel =
    viewMode === "mois"
      ? `${moisNoms[filter.mois]} ${filter.annee}`
      : `Année ${filter.annee}`;

  // ── CORRECTION PRINCIPALE : on lit mensuel ou annuel selon le mode ──
  const currentStats = viewMode === "mois" ? stats.mensuel : stats.annuel;

  const toggleCat = (n) => setExpandedCats((p) => ({ ...p, [n]: !p[n] }));

  const handleEdit = (dep) => {
    setEditingId(dep._id);
    setForm({
      description: dep.description,
      montant: dep.montant,
      id_categorieDepense: dep.id_categorieDepense?._id || "",
      date: new Date(dep.date).toISOString().split("T")[0],
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId)
        await API.put(
          API_PATHS.DEPENSES.UPDATE_DEPENSE.replace(":id", editingId),
          form,
        );
      else await API.post(API_PATHS.DEPENSES.CREATE_DEPENSE, form);
      setIsModalOpen(false);
      setEditingId(null);
      setForm({
        description: "",
        montant: "",
        id_categorieDepense: "",
        date: new Date().toISOString().split("T")[0],
      });
      loadPageData();
    } catch (err) {
      alert(err.response?.data?.message || "Erreur");
    }
  };

  const deleteItem = async (id) => {
    if (!window.confirm("Supprimer cette dépense ?")) return;
    try {
      await API.delete(API_PATHS.DEPENSES.DELETE_DEPENSE.replace(":id", id));
      loadPageData();
    } catch {
      alert("Erreur");
    }
  };

  const kpiData = [
    {
      label: "Bénéfice Brut",
      value: currentStats?.beneficeBrut ?? null,
      sub: periodeLabel,
      icon: TrendingUp,
      accent: "#2563EB",
    },
    {
      label: "Total Dépenses",
      value: totalDepenses,
      sub: `${totalEntries} opération${totalEntries !== 1 ? "s" : ""}`,
      icon: Wallet,
      accent: T.accent,
    },
    {
      label: "Bénéfice Net",
      value: currentStats?.beneficeReel ?? null,
      sub: "Après charges",
      icon: BarChart3,
      accent: "#059669",
    },
  ];

  return (
    <>
      <style>{`
        .dep-wrap { padding: 28px 32px; }
        .dep-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:28px; animation: dep-down .38s ease both; }
        .dep-title  { font-size:20px; font-weight:800; letter-spacing:-.5px; color:${T.ink}; }
        .dep-sub    { font-size:11px; font-weight:600; color:${T.inkLight}; text-transform:uppercase; letter-spacing:1.1px; margin-top:2px; }
        .dep-actions{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .dep-toggle { display:flex; background:${T.surface}; border:1px solid ${T.border}; border-radius:9px; padding:3px; }
        .dep-toggle-btn { padding:6px 14px; border-radius:6px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.7px; color:${T.inkLight}; background:transparent; border:none; cursor:pointer; transition:all .15s; }
        .dep-toggle-btn.active { background:${T.ink}; color:#fff; box-shadow:0 2px 6px rgba(15,23,42,.16); }
        .dep-toggle-btn:not(.active):hover { color:${T.inkMid}; background:${T.surfaceAlt}; }
        .dep-period { display:flex; align-items:center; gap:8px; background:${T.surface}; border:1px solid ${T.border}; border-radius:9px; padding:7px 13px; font-size:12px; font-weight:600; color:${T.ink}; }
        .dep-period select, .dep-period input[type="number"] { background:transparent; border:none; outline:none; font-size:12px; font-weight:600; color:${T.ink}; cursor:pointer; }
        .dep-period input[type="number"] { width:56px; }
        .dep-period-sep { width:1px; height:14px; background:${T.border}; margin:0 2px; }
        .dep-btn-add { display:flex; align-items:center; gap:7px; background:${T.accent}; color:#fff; border:none; border-radius:9px; padding:9px 16px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.7px; cursor:pointer; box-shadow:0 3px 12px rgba(225,29,72,.22); transition:all .15s; }
        .dep-btn-add:hover { background:#BE123C; transform:translateY(-1px); box-shadow:0 5px 16px rgba(225,29,72,.28); }
        .dep-btn-add:active { transform:none; }
        .dep-kpi-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:16px; }
        .dep-kpi { background:${T.surface}; border:1px solid ${T.borderLight}; border-radius:14px; padding:20px 22px 18px; animation:dep-up .42s ease both; transition:box-shadow .18s; }
        .dep-kpi:hover { box-shadow:0 6px 24px rgba(15,23,42,.06); }
        .dep-kpi-top  { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
        .dep-kpi-label{ font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:${T.inkLight}; }
        .dep-kpi-icon { width:30px; height:30px; border-radius:7px; display:flex; align-items:center; justify-content:center; }
        .dep-kpi-value{ font-size:24px; font-weight:700; color:${T.ink}; letter-spacing:-.8px; display:flex; align-items:baseline; gap:5px; font-variant-numeric:tabular-nums; }
        .dep-kpi-cur  { font-size:10px; font-weight:600; color:${T.inkLight}; letter-spacing:.4px; }
        .dep-kpi-na   { font-size:18px; color:${T.inkLight}; }
        .dep-kpi-sub  { font-size:11px; font-weight:500; color:${T.inkLight}; margin-top:7px; }
        .dep-summary { background:${T.surface}; border:1px solid ${T.borderLight}; border-radius:11px; padding:12px 18px; display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; animation:dep-up .42s .08s ease both; }
        .dep-summary-l { display:flex; align-items:center; gap:14px; }
        .dep-summary-badge { display:flex; align-items:center; gap:6px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.7px; color:${T.inkMid}; }
        .dep-summary-dot  { width:5px; height:5px; border-radius:50%; background:${T.accent}; }
        .dep-summary-period { font-size:11px; font-weight:600; color:${T.inkMid}; padding-left:14px; border-left:1px solid ${T.border}; }
        .dep-summary-total { font-size:13px; font-weight:700; color:${T.ink}; font-variant-numeric:tabular-nums; }
        .dep-summary-total em { font-style:normal; font-size:9px; font-weight:600; color:${T.inkLight}; margin-left:4px; }
        .dep-table-wrap   { background:${T.surface}; border:1px solid ${T.borderLight}; border-radius:14px; overflow:hidden; animation:dep-up .42s .12s ease both; }
        .dep-table-scroll { overflow-y:auto; max-height:520px; }
        .dep-table-scroll::-webkit-scrollbar { width:3px; }
        .dep-table-scroll::-webkit-scrollbar-track { background:transparent; }
        .dep-table-scroll::-webkit-scrollbar-thumb { background:${T.border}; border-radius:3px; }
        .dep-table { width:100%; border-collapse:collapse; }
        .dep-table thead tr { background:${T.surfaceAlt}; position:sticky; top:0; z-index:5; }
        .dep-table thead th { padding:11px 18px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:${T.inkLight}; border-bottom:1px solid ${T.borderLight}; white-space:nowrap; }
        .dep-table .th-r, .dep-table .td-r { text-align:right; }
        .dep-table .th-act, .dep-table .td-act { text-align:right; width:80px; }
        .dep-row-cat { border-bottom:1px solid ${T.borderLight}; cursor:pointer; transition:background .12s; }
        .dep-row-cat:hover { background:${T.surfaceAlt}; }
        .dep-row-cat td { padding:12px 18px; }
        .dep-cat-cell { display:flex; align-items:center; gap:9px; }
        .dep-cat-chev { width:18px; height:18px; border-radius:4px; border:1px solid ${T.border}; background:${T.surfaceAlt}; display:flex; align-items:center; justify-content:center; color:${T.inkLight}; flex-shrink:0; transition:all .15s; }
        .dep-row-cat:hover .dep-cat-chev { background:${T.ink}; border-color:${T.ink}; color:#fff; }
        .dep-cat-name { font-size:12px; font-weight:700; color:${T.ink}; }
        .dep-cat-pill { font-size:9px; font-weight:700; color:${T.inkLight}; background:${T.surfaceAlt}; border:1px solid ${T.border}; padding:1px 6px; border-radius:20px; text-transform:uppercase; letter-spacing:.4px; }
        .dep-cat-total{ font-size:13px; font-weight:700; color:${T.ink}; font-variant-numeric:tabular-nums; }
        .dep-cat-total em { font-style:normal; font-size:9px; font-weight:600; color:${T.inkLight}; margin-left:3px; }
        .dep-row-item { border-bottom:1px solid ${T.borderLight}; transition:background .1s; animation:dep-row .18s ease both; }
        .dep-row-item:hover { background:#FFF4F6; }
        .dep-row-item td { padding:10px 18px; }
        .dep-row-item td:first-child { padding-left:48px; }
        .dep-item-desc { font-size:12px; font-weight:500; color:${T.inkMid}; }
        .dep-item-meta { display:flex; align-items:center; gap:6px; margin-top:2px; }
        .dep-item-date { font-size:10px; font-weight:400; color:${T.inkLight}; font-variant-numeric:tabular-nums; }
        .dep-item-month{ background:#EFF6FF; color:#2563EB; font-size:9px; font-weight:700; padding:1px 5px; border-radius:3px; text-transform:uppercase; letter-spacing:.4px; }
        .dep-item-amount { font-size:12px; font-weight:700; color:${T.accent}; font-variant-numeric:tabular-nums; }
        .dep-item-neg   { opacity:.5; font-size:10px; margin-right:1px; }
        .dep-item-mru   { font-size:9px; font-weight:600; color:${T.inkLight}; margin-left:2px; }
        .dep-item-actions { display:flex; align-items:center; justify-content:flex-end; gap:3px; }
        .dep-btn-icon { width:26px; height:26px; border-radius:6px; border:none; background:transparent; color:${T.inkLight}; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .13s; }
        .dep-btn-icon.edit:hover { background:#EFF6FF; color:#2563EB; }
        .dep-btn-icon.del:hover  { background:${T.accentMuted}; color:${T.accent}; }
        .dep-row-empty td, .dep-row-loading td { padding:60px 18px; text-align:center; }
        .dep-spinner { width:26px; height:26px; border:2.5px solid ${T.borderLight}; border-top-color:${T.accent}; border-radius:50%; animation:dep-spin .65s linear infinite; margin:0 auto 10px; }
        .dep-loading-txt { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:${T.inkLight}; }
        .dep-empty-txt   { font-size:12px; font-weight:600; color:${T.inkLight}; }
        .dep-modal-bg  { position:fixed; inset:0; z-index:200; background:rgba(15,23,42,.48); backdrop-filter:blur(5px); display:flex; align-items:center; justify-content:center; padding:16px; animation:dep-fadein .18s ease both; }
        .dep-modal-box { background:${T.surface}; width:100%; max-width:400px; border-radius:18px; overflow:hidden; box-shadow:0 28px 70px rgba(15,23,42,.18); animation:dep-scaleup .2s ease both; }
        .dep-modal-head{ padding:18px 22px; border-bottom:1px solid ${T.borderLight}; background:${T.surfaceAlt}; display:flex; justify-content:space-between; align-items:center; }
        .dep-modal-title{ font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.9px; color:${T.ink}; }
        .dep-modal-close{ width:26px; height:26px; border-radius:6px; border:1px solid ${T.border}; background:${T.surface}; color:${T.inkLight}; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .13s; }
        .dep-modal-close:hover { background:${T.accentMuted}; color:${T.accent}; border-color:#FECDD3; }
        .dep-modal-body{ padding:22px; display:flex; flex-direction:column; gap:14px; }
        .dep-field { display:flex; flex-direction:column; gap:5px; }
        .dep-field-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.8px; color:${T.inkLight}; }
        .dep-field-input { width:100%; padding:10px 13px; background:${T.surfaceAlt}; border:1px solid ${T.borderLight}; border-radius:9px; font-size:13px; font-weight:500; color:${T.ink}; outline:none; transition:border .14s, box-shadow .14s; box-sizing:border-box; }
        .dep-field-input:focus { border-color:${T.accent}; box-shadow:0 0 0 3px rgba(225,29,72,.07); }
        .dep-field-input.f-amount { font-size:20px; font-weight:700; color:${T.accent}; letter-spacing:-.5px; padding:12px 13px; font-variant-numeric:tabular-nums; }
        .dep-btn-submit { width:100%; padding:12px; background:${T.ink}; color:#fff; border:none; border-radius:10px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.9px; cursor:pointer; margin-top:2px; transition:all .15s; }
        .dep-btn-submit:hover { background:${T.accent}; box-shadow:0 5px 18px rgba(225,29,72,.22); }
        @keyframes dep-down   { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:none; } }
        @keyframes dep-up     { from { opacity:0; transform:translateY(12px);  } to { opacity:1; transform:none; } }
        @keyframes dep-fadein { from { opacity:0; } to { opacity:1; } }
        @keyframes dep-scaleup{ from { opacity:0; transform:scale(.96); } to { opacity:1; transform:scale(1); } }
        @keyframes dep-row    { from { opacity:0; transform:translateX(-5px); } to { opacity:1; transform:none; } }
        @keyframes dep-spin   { to { transform:rotate(360deg); } }
        @media (max-width:768px) {
          .dep-wrap { padding:16px; }
          .dep-kpi-grid { grid-template-columns:1fr; }
          .dep-header { flex-direction:column; align-items:flex-start; gap:14px; }
        }
      `}</style>

      <div className="dep-wrap">
        <div className="dep-header">
          <div>
            <div className="dep-title">Journal de Caisse</div>
            <div className="dep-sub">Analyse des flux financiers</div>
          </div>
          <div className="dep-actions">
            <Toggle
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: "mois", label: "Mois" },
                { value: "annee", label: "Année" },
              ]}
            />
            <div className="dep-period">
              <Calendar size={13} color={T.inkLight} />
              {viewMode === "mois" && (
                <>
                  <select
                    value={filter.mois}
                    onChange={(e) =>
                      setFilter({ ...filter, mois: parseInt(e.target.value) })
                    }
                  >
                    {moisNoms.map((m, i) => (
                      <option key={i} value={i}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <div className="dep-period-sep" />
                </>
              )}
              <input
                type="number"
                value={filter.annee}
                onChange={(e) =>
                  setFilter({ ...filter, annee: parseInt(e.target.value) })
                }
              />
            </div>
            <button
              className="dep-btn-add"
              onClick={() => {
                setEditingId(null);
                setIsModalOpen(true);
              }}
            >
              <Plus size={13} strokeWidth={2.5} /> Nouveau décaissement
            </button>
          </div>
        </div>

        <div className="dep-kpi-grid">
          {kpiData.map((k, i) => (
            <KpiCard key={k.label} {...k} delay={i * 55} />
          ))}
        </div>

        <div className="dep-summary">
          <div className="dep-summary-l">
            <div className="dep-summary-badge">
              <div className="dep-summary-dot" />
              <Layers size={11} />
              {totalEntries} opération{totalEntries !== 1 ? "s" : ""}
            </div>
            <div className="dep-summary-period">{periodeLabel}</div>
          </div>
          <div className="dep-summary-total">
            {totalDepenses.toLocaleString("fr-FR")} <em>MRU total</em>
          </div>
        </div>

        <div className="dep-table-wrap">
          <div className="dep-table-scroll">
            <table className="dep-table">
              <thead>
                <tr>
                  <th>Catégorie / Description</th>
                  <th className="th-r">Montant</th>
                  <th className="th-act">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className="dep-row-loading">
                    <td colSpan={3}>
                      <div className="dep-spinner" />
                      <div className="dep-loading-txt">Chargement</div>
                    </td>
                  </tr>
                ) : Object.keys(groupedDepenses).length === 0 ? (
                  <tr className="dep-row-empty">
                    <td colSpan={3}>
                      <div className="dep-empty-txt">
                        Aucune dépense pour <strong>{periodeLabel}</strong>
                      </div>
                    </td>
                  </tr>
                ) : (
                  Object.entries(groupedDepenses).map(([catName, catData]) => (
                    <React.Fragment key={catName}>
                      <tr
                        className="dep-row-cat"
                        onClick={() => toggleCat(catName)}
                      >
                        <td>
                          <div className="dep-cat-cell">
                            <div className="dep-cat-chev">
                              <ChevronDown
                                size={10}
                                strokeWidth={2.5}
                                style={{
                                  transform: expandedCats[catName]
                                    ? "rotate(0)"
                                    : "rotate(-90deg)",
                                  transition: "transform .18s",
                                }}
                              />
                            </div>
                            <span className="dep-cat-name">{catName}</span>
                            <span className="dep-cat-pill">
                              {catData.list.length}
                            </span>
                          </div>
                        </td>
                        <td className="td-r">
                          <span className="dep-cat-total">
                            {catData.total.toLocaleString("fr-FR")}
                            <em>MRU</em>
                          </span>
                        </td>
                        <td />
                      </tr>
                      {expandedCats[catName] &&
                        catData.list.map((dep, idx) => (
                          <tr
                            className="dep-row-item"
                            key={dep._id}
                            style={{ animationDelay: `${idx * 25}ms` }}
                          >
                            <td>
                              <div className="dep-item-desc">
                                {dep.description}
                              </div>
                              <div className="dep-item-meta">
                                <span className="dep-item-date">
                                  {new Date(dep.date).toLocaleDateString(
                                    "fr-FR",
                                  )}
                                </span>
                                {viewMode === "annee" && (
                                  <span className="dep-item-month">
                                    {moisNoms[
                                      new Date(dep.date).getMonth()
                                    ].slice(0, 3)}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="td-r">
                              <span className="dep-item-amount">
                                <span className="dep-item-neg">−</span>
                                {dep.montant.toLocaleString("fr-FR")}
                                <span className="dep-item-mru">MRU</span>
                              </span>
                            </td>
                            <td className="td-act">
                              <div className="dep-item-actions">
                                <button
                                  className="dep-btn-icon edit"
                                  onClick={() => handleEdit(dep)}
                                >
                                  <Edit3 size={12} strokeWidth={2} />
                                </button>
                                <button
                                  className="dep-btn-icon del"
                                  onClick={() => deleteItem(dep._id)}
                                >
                                  <Trash2 size={12} strokeWidth={2} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div
          className="dep-modal-bg"
          onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}
        >
          <div className="dep-modal-box">
            <div className="dep-modal-head">
              <span className="dep-modal-title">
                {editingId ? "Modifier" : "Nouveau décaissement"}
              </span>
              <button
                className="dep-modal-close"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={13} strokeWidth={2.5} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="dep-modal-body">
                <div className="dep-field">
                  <label className="dep-field-label">Catégorie</label>
                  <select
                    required
                    className="dep-field-input"
                    value={form.id_categorieDepense}
                    onChange={(e) =>
                      setForm({ ...form, id_categorieDepense: e.target.value })
                    }
                  >
                    <option value="">Sélectionner…</option>
                    {data.categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="dep-field">
                  <label className="dep-field-label">Description</label>
                  <input
                    type="text"
                    required
                    className="dep-field-input"
                    placeholder="Libellé de l'opération"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </div>
                <div className="dep-field">
                  <label className="dep-field-label">Date</label>
                  <input
                    type="date"
                    required
                    className="dep-field-input"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div className="dep-field">
                  <label className="dep-field-label">Montant (MRU)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="dep-field-input f-amount"
                    placeholder="0"
                    value={form.montant}
                    onChange={(e) =>
                      setForm({ ...form, montant: e.target.value })
                    }
                  />
                </div>
                <button type="submit" className="dep-btn-submit">
                  {editingId ? "Mettre à jour" : "Valider la sortie"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Depenses;
