import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  PlusCircle,
  Edit2,
  MoreHorizontal,
  Trash2,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Filter,
  X,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import Modal from "../../components/ui/Modal";
import API from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";

import CreateBlForm from "./CreateBlForm";
import UpdateBlForm from "./UpdateBlForm";

// ─── Constantes ────────────────────────────────────────────────────────────────
const CHARGES_FIXES_NOMS = [
  "Liquidation",
  "Manutention",
  "Charges Locales",
  "Facture Port",
  "TS Douane",
  "Transport",
  "Déchargement",
  "Bon de sortie Port",
  "Bon de sortie Douane",
  "Bomop",
  "Amende",
  "Forfait",
  "Dépense H",
];

const SORT_DIRECTIONS = { NONE: "none", ASC: "asc", DESC: "desc" };

// ─── Icône de tri ──────────────────────────────────────────────────────────────
const SortIcon = ({ direction }) => {
  if (direction === SORT_DIRECTIONS.ASC)
    return <ChevronUp size={12} className="text-red-500" />;
  if (direction === SORT_DIRECTIONS.DESC)
    return <ChevronDown size={12} className="text-red-500" />;
  return <ChevronsUpDown size={12} className="text-slate-300" />;
};

// ─── En-tête de colonne triable ────────────────────────────────────────────────
const SortableHeader = ({ label, colKey, sortConfig, onSort }) => {
  const direction =
    sortConfig.key === colKey ? sortConfig.direction : SORT_DIRECTIONS.NONE;
  return (
    <th
      className="px-6 py-4 cursor-pointer select-none group"
      onClick={() => onSort(colKey)}
    >
      <div className="flex items-center gap-1.5">
        <span>{label}</span>
        <span className="opacity-60 group-hover:opacity-100 transition-opacity">
          <SortIcon direction={direction} />
        </span>
      </div>
    </th>
  );
};

// ─── Composant principal ───────────────────────────────────────────────────────
const AllBLs = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // --- ÉTATS ---
  const [bls, setBls] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState(
    () => location.state?.searchTerm ?? "",
  );
  const [statusFilter, setStatusFilter] = useState(
    () => location.state?.statusFilter ?? "tous",
  );

  // --- filtre charges non payées (multi-sélection) ---
  const [chargeFilters, setChargeFilters] = useState(
    () => location.state?.chargeFilters ?? [],
  );
  const [isChargeDropdownOpen, setIsChargeDropdownOpen] = useState(false);

  const toggleChargeFilter = (nom) => {
    setChargeFilters((prev) =>
      prev.includes(nom) ? prev.filter((c) => c !== nom) : [...prev, nom],
    );
  };

  // --- tri des colonnes ---
  const [sortConfig, setSortConfig] = useState(
    () =>
      location.state?.sortConfig ?? {
        key: null,
        direction: SORT_DIRECTIONS.NONE,
      },
  );

  // --- AUTH / RÔLES ---
  const userDataRaw = localStorage.getItem("_appTransit_user");
  const userData = userDataRaw ? JSON.parse(userDataRaw) : null;
  const userRole = userData?.role;
  const isAdmin = userRole === "admin";
  const isSuperviseur = userRole === "superviseur";

  // --- MODALS ---
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedBL, setSelectedBL] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);

  // --- CHARGEMENT DES DONNÉES ---
  const fetchData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      else setIsRefreshing(true);

      const [resBL, resClients] = await Promise.all([
        API.get(API_PATHS.BLS.GET_ALL_BL),
        API.get(API_PATHS.CLIENTS.GET_ALL_CLIENTS),
      ]);

      setBls(resBL.data.data || []);
      setClients(resClients.data.data || []);
    } catch (err) {
      toast.error(err.message || "Erreur de chargement des données");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleClickOutside = () => {
      setActiveMenu(null);
      setIsChargeDropdownOpen(false);
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // --- PERSISTANCE DE L'ÉTAT ---
  useEffect(() => {
    navigate(location.pathname, {
      replace: true,
      state: { statusFilter, searchTerm, chargeFilters, sortConfig },
    });
  }, [statusFilter, searchTerm, chargeFilters, sortConfig]);

  // --- NAVIGATION VERS UN BL ---
  const handleRowClick = (bl) => {
    navigate(`/bls/${bl._id}`, {
      state: {
        from: location.pathname,
        statusFilter,
        searchTerm,
        chargeFilters,
        sortConfig,
      },
    });
  };

  // --- ACTIONS ---
  const handleConfirmDelete = async () => {
    if (!selectedBL) return;
    try {
      await API.delete(`${API_PATHS.BLS.DELETE_BL}/${selectedBL._id}`);
      toast.success("Dossier supprimé avec succès");
      setIsDeleteOpen(false);
      setSelectedBL(null);
      fetchData(true);
    } catch (err) {
      toast.error(err.message || "Erreur lors de la suppression");
    }
  };

  // --- NOUVEAU : logique de tri ---
  const handleSort = (colKey) => {
    setSortConfig((prev) => {
      if (prev.key !== colKey)
        return { key: colKey, direction: SORT_DIRECTIONS.ASC };
      if (prev.direction === SORT_DIRECTIONS.ASC)
        return { key: colKey, direction: SORT_DIRECTIONS.DESC };
      return { key: null, direction: SORT_DIRECTIONS.NONE };
    });
  };

  // --- ONGLETS DISPONIBLES ---
  const availableTabs = useMemo(() => {
    const tabs = ["tous", "En attente", "En cours"];
    if (isAdmin || isSuperviseur) tabs.push("A validé");
    if (isAdmin) tabs.push("Facturé");
    return tabs;
  }, [isAdmin, isSuperviseur]);

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(statusFilter)) {
      setStatusFilter("tous");
    }
  }, [availableTabs]);

  // --- FILTRE + TRI combinés ---
  const filteredBLs = useMemo(() => {
    let result = bls.filter((bl) => {
      const status = bl.etatBl?.trim();

      if (status === "A validé" && !isAdmin && !isSuperviseur) return false;
      if (status === "Facturé" && !isAdmin) return false;

      const searchString = searchTerm.toLowerCase();
      const matchesSearch =
        bl.numBl?.toLowerCase().includes(searchString) ||
        bl.id_client?.nom?.toLowerCase().includes(searchString) ||
        bl.codeBl?.toLowerCase().includes(searchString);

      const matchesStatus = statusFilter === "tous" || status === statusFilter;

      // filtre charges non payées (multi-sélection — logique AND : toutes les charges sélectionnées doivent être non payées)
      const matchesCharge =
        chargeFilters.length === 0 ||
        chargeFilters.every((filterNom) =>
          (bl.chargesFixes || []).some(
            (c) =>
              c.nom?.trim().toLowerCase() === filterNom.trim().toLowerCase() &&
              c.paye === false,
          ),
        );

      return matchesSearch && matchesStatus && matchesCharge;
    });

    // NOUVEAU : application du tri
    if (sortConfig.key && sortConfig.direction !== SORT_DIRECTIONS.NONE) {
      result = [...result].sort((a, b) => {
        let valA, valB;

        switch (sortConfig.key) {
          case "codeBl":
            valA = a.codeBl?.toLowerCase() ?? "";
            valB = b.codeBl?.toLowerCase() ?? "";
            break;
          case "numBl":
            valA = a.numBl?.toLowerCase() ?? "";
            valB = b.numBl?.toLowerCase() ?? "";
            break;
          case "client":
            valA = a.id_client?.nom?.toLowerCase() ?? "";
            valB = b.id_client?.nom?.toLowerCase() ?? "";
            break;
          case "charges":
            valA = a.totalCharge > 0 ? a.totalChargePayer / a.totalCharge : 0;
            valB = b.totalCharge > 0 ? b.totalChargePayer / b.totalCharge : 0;
            break;
          case "conteneurs":
            valA = a.nbrDeConteneur ?? 0;
            valB = b.nbrDeConteneur ?? 0;
            break;
          case "liquidation":
            valA = a.estLiquide ? 1 : 0;
            valB = b.estLiquide ? 1 : 0;
            break;
          case "statut":
            valA = a.etatBl?.toLowerCase() ?? "";
            valB = b.etatBl?.toLowerCase() ?? "";
            break;
          default:
            return 0;
        }

        if (valA < valB)
          return sortConfig.direction === SORT_DIRECTIONS.ASC ? -1 : 1;
        if (valA > valB)
          return sortConfig.direction === SORT_DIRECTIONS.ASC ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [
    bls,
    searchTerm,
    statusFilter,
    isAdmin,
    isSuperviseur,
    chargeFilters,
    sortConfig,
  ]);

  // --- SOUS-COMPOSANTS ---
  const ChargeProgress = ({ paye, total }) => {
    const percentage = total > 0 ? Math.min((paye / total) * 100, 100) : 0;
    return (
      <div className="w-full max-w-[120px]">
        <div className="flex justify-between items-center mb-1 text-[10px] font-black">
          <span className="text-slate-400 uppercase">
            {paye}/{total}
          </span>
          <span className="text-red-500">{Math.round(percentage)}%</span>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-500 transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  const StatusBadge = ({ etat }) => {
    const colors = {
      "En attente": "text-orange-500 bg-orange-50",
      "En cours": "text-blue-500 bg-blue-50",
      "A validé": "text-purple-600 bg-purple-50",
      Facturé: "text-emerald-600 bg-emerald-100",
    };
    return (
      <span
        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase ${
          colors[etat] || "text-slate-400 bg-slate-50"
        }`}
      >
        {etat}
      </span>
    );
  };

  // --- RENDU ---
  if (isLoading)
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4">
        <div className="size-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Chargement des dossiers...
        </p>
      </div>
    );

  return (
    <div className="max-w-[1400px] mx-auto p-6 lg:p-10 space-y-8 animate-fadeIn">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Bill of Lading (BL)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gérez et suivez l'état de vos dossiers d'expédition.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => fetchData(true)}
            className={`p-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all ${
              isRefreshing ? "animate-spin" : ""
            }`}
            title="Rafraîchir les données"
          >
            <RefreshCw size={18} />
          </button>

          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
            <input
              type="text"
              placeholder="Rechercher BL, client..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-red-500/5 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {(isAdmin || isSuperviseur) && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="bg-[#EF233C] hover:bg-[#D90429] text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-red-500/20 transition-all active:scale-95"
            >
              <PlusCircle size={18} /> Nouveau
            </button>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-8 border-b border-slate-200 text-sm font-bold text-slate-400 overflow-x-auto scrollbar-hide">
        {availableTabs.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`pb-4 capitalize whitespace-nowrap transition-all border-b-2 ${
              statusFilter === f
                ? "border-red-500 text-slate-900"
                : "border-transparent hover:text-slate-600"
            }`}
          >
            {f === "tous" ? "Tous les dossiers" : f}
          </button>
        ))}
      </div>

      {/* ── FILTRE PAR CHARGES NON RÉGLÉES (multi-sélection) ── */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mt-2.5">
          <Filter size={14} />
          <span>Charges non réglées :</span>
        </div>

        {/* Dropdown multi-select */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setIsChargeDropdownOpen((prev) => !prev)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${
              chargeFilters.length > 0
                ? "border-red-400 bg-red-50 text-red-600"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <span>
              {chargeFilters.length === 0
                ? "Sélectionner des charges..."
                : `${chargeFilters.length} charge${chargeFilters.length > 1 ? "s" : ""} sélectionnée${chargeFilters.length > 1 ? "s" : ""}`}
            </span>
            <ChevronDown
              size={14}
              className={`transition-transform ${isChargeDropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isChargeDropdownOpen && (
            <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-slate-100 rounded-xl shadow-xl z-50 py-2 animate-in zoom-in-95">
              {/* En-tête avec compteur + tout désélectionner */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {chargeFilters.length} / {CHARGES_FIXES_NOMS.length}{" "}
                  sélectionnée(s)
                </span>
                {chargeFilters.length > 0 && (
                  <button
                    onClick={() => setChargeFilters([])}
                    className="text-[10px] font-bold text-red-500 hover:text-red-700 transition-colors"
                  >
                    Tout effacer
                  </button>
                )}
              </div>

              {/* Liste des charges avec checkbox */}
              <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
                {CHARGES_FIXES_NOMS.map((nom) => {
                  const isChecked = chargeFilters.includes(nom);
                  return (
                    <button
                      key={nom}
                      onClick={() => toggleChargeFilter(nom)}
                      className={`w-full text-left px-4 py-2.5 text-xs font-bold flex items-center gap-3 transition-colors ${
                        isChecked
                          ? "bg-red-50 text-red-600"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {/* Checkbox custom */}
                      <span
                        className={`size-4 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all ${
                          isChecked
                            ? "bg-red-500 border-red-500"
                            : "border-slate-300"
                        }`}
                      >
                        {isChecked && (
                          <svg
                            width="8"
                            height="6"
                            viewBox="0 0 8 6"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M1 3L3 5L7 1"
                              stroke="white"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      {nom}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Badges des charges sélectionnées */}
        {chargeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            {chargeFilters.map((nom) => (
              <div
                key={nom}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl"
              >
                <span className="text-xs font-bold text-red-600">{nom}</span>
                <button
                  onClick={() => toggleChargeFilter(nom)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Reset tri */}
        {sortConfig.key && (
          <button
            onClick={() =>
              setSortConfig({ key: null, direction: SORT_DIRECTIONS.NONE })
            }
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 transition-colors mt-0.5"
          >
            <X size={12} /> Réinitialiser le tri
          </button>
        )}
      </div>

      {/* TABLEAU */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 z-20 bg-slate-50 shadow-sm">
              <tr className="text-[11px] font-black uppercase text-slate-400 tracking-widest">
                <SortableHeader
                  label="Code / Date"
                  colKey="codeBl"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Numero BL"
                  colKey="numBl"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Client"
                  colKey="client"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Charges"
                  colKey="charges"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Num/Qte"
                  colKey="conteneurs"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Liquidation"
                  colKey="liquidation"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Statut"
                  colKey="statut"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <th className="px-6 py-4 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredBLs.length > 0 ? (
                filteredBLs.map((bl) => (
                  <tr
                    key={bl._id}
                    onClick={() => handleRowClick(bl)}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-5">
                      <div className="text-sm font-bold text-slate-900 group-hover:text-red-600 transition-colors">
                        {bl.codeBl}
                      </div>
                      <div className="text-[10px] font-medium text-slate-400 mt-1 uppercase">
                        {new Date(bl.createdAt).toLocaleDateString("fr-FR")}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-sm font-bold text-slate-900">
                        {bl.numBl}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-sm font-semibold uppercase text-slate-700">
                        {bl.id_client?.nom || "N/A"}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <ChargeProgress
                        paye={bl.totalChargePayer || 0}
                        total={bl.totalCharge || 0}
                      />
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-sm font-bold text-slate-900 truncate max-w-[150px]">
                        {bl.numDeConteneur || "---"}
                      </div>
                      <div className="text-[10px] font-bold text-red-500 mt-0.5 uppercase tracking-wider">
                        {bl.nbrDeConteneur || 0} CONTENEUR(S)
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider ${
                          bl.estLiquide ? "text-emerald-600" : "text-slate-400"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            bl.estLiquide ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                        ></span>
                        {bl.estLiquide ? "Liquidée" : "En attente"}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <StatusBadge etat={bl.etatBl} />
                    </td>
                    <td className="px-6 py-5 text-right relative">
                      {(isAdmin || isSuperviseur) && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenu(
                                activeMenu === bl._id ? null : bl._id,
                              );
                            }}
                            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <MoreHorizontal size={20} />
                          </button>
                          {activeMenu === bl._id && (
                            <div className="absolute right-10 top-12 w-52 bg-white border border-slate-100 rounded-xl shadow-xl z-50 py-2 animate-in zoom-in-95">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBL(bl);
                                  setIsUpdateOpen(true);
                                  setActiveMenu(null);
                                }}
                                className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <Edit2 size={14} className="text-blue-500" />{" "}
                                Modifier le dossier
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBL(bl);
                                    setIsDeleteOpen(true);
                                    setActiveMenu(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Trash2 size={14} /> Supprimer
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="px-6 py-20 text-center">
                    <p className="text-slate-400 font-bold text-sm uppercase">
                      Aucun dossier trouvé
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t border-slate-50 bg-slate-50/30 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Total : {filteredBLs.length} Dossier(s) affiché(s)
          </p>
          {chargeFilters.length > 0 && (
            <p className="text-xs font-bold text-red-400 uppercase tracking-widest">
              Filtre actif : {chargeFilters.join(" + ")} — non réglée(s)
            </p>
          )}
        </div>
      </div>

      {/* MODALS */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Créer un Bill of Lading"
      >
        <CreateBlForm
          clients={clients}
          onCancel={() => setIsCreateOpen(false)}
          onSuccess={() => {
            setIsCreateOpen(false);
            fetchData(true);
          }}
        />
      </Modal>

      <Modal
        isOpen={isUpdateOpen}
        onClose={() => setIsUpdateOpen(false)}
        title="Modifier le Dossier"
      >
        <UpdateBlForm
          bl={selectedBL}
          clients={clients}
          onCancel={() => setIsUpdateOpen(false)}
          onSuccess={() => {
            setIsUpdateOpen(false);
            fetchData(true);
          }}
        />
      </Modal>

      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Confirmation de suppression"
      >
        <div className="p-1">
          <div className="flex items-center gap-4 mb-6 p-4 bg-red-50 rounded-2xl border border-red-100">
            <div className="size-12 bg-red-500 rounded-xl flex items-center justify-center text-white shadow-lg">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase">
                Action Irréversible
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Suppression du dossier{" "}
                <span className="font-bold text-red-600">
                  {selectedBL?.numBl}
                </span>
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-8 px-1">
            Êtes-vous sûr de vouloir supprimer définitivement ce dossier ?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setIsDeleteOpen(false)}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 bg-slate-100"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirmDelete}
              className="flex-[1.5] px-4 py-3 rounded-xl text-sm font-bold text-white bg-[#EF233C]"
            >
              Supprimer le dossier
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AllBLs;
