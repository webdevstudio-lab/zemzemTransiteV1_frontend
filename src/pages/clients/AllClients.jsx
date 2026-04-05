import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  UserPlus,
  Edit2,
  Trash2,
  MoreHorizontal,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Layers,
  Box,
  Download,
  Users,
  TrendingUp,
  TrendingDown,
  CheckCircle,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import Modal from "../../components/ui/Modal";
import API from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import { useAuth } from "../../context/AuthContext";
import CreateClientForm from "./CreateClientForm";
import UpdateClientForm from "./UpdateClientForm";

const TABS = [
  {
    key: "tous",
    label: "Tous les clients",
    icon: Users,
    color: "text-slate-600",
    activeBg: "bg-white",
    activeBorder: "border-slate-300",
    activeText: "text-slate-900",
    dot: "bg-slate-400",
  },
  {
    key: "crediteur",
    label: "Créditeurs",
    icon: TrendingUp,
    color: "text-red-500",
    activeBg: "bg-white",
    activeBorder: "border-red-300",
    activeText: "text-red-600",
    dot: "bg-red-500",
    description: "Solde > 0",
  },
  {
    key: "debiteur",
    label: "Débiteurs",
    icon: TrendingDown,
    color: "text-emerald-500",
    activeBg: "bg-white",
    activeBorder: "border-emerald-300",
    activeText: "text-emerald-600",
    dot: "bg-emerald-500",
    description: "Solde < 0",
  },
  {
    key: "regle",
    label: "En règle",
    icon: CheckCircle,
    color: "text-blue-500",
    activeBg: "bg-white",
    activeBorder: "border-blue-300",
    activeText: "text-blue-600",
    dot: "bg-blue-500",
    description: "Solde = 0",
  },
];

const AllClients = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Ref pour ignorer le premier render dans le useEffect de persistance
  const isMounted = useRef(false);

  // Lecture du state AVANT l'initialisation des useState
  const savedState = location.state;

  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(savedState?.searchTerm ?? "");
  const [activeTab, setActiveTab] = useState(savedState?.activeTab ?? "tous");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);

  // --- CHARGEMENT DES DONNÉES ---
  const fetchClients = async () => {
    try {
      setIsLoading(true);
      const response = await API.get(API_PATHS.CLIENTS.GET_ALL_CLIENTS);
      setClients(response.data.data || []);
    } catch (err) {
      toast.error("Erreur de récupération des clients");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
    const handleClickOutside = () => setActiveMenu(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // --- PERSISTANCE : on saute le premier render pour ne pas écraser le state restauré ---
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    navigate(location.pathname, {
      replace: true,
      state: { activeTab, searchTerm },
    });
  }, [activeTab, searchTerm]);

  // --- NAVIGATION VERS UN CLIENT ---
  const handleRowClick = (client) => {
    navigate(`/clients/${client._id}`);
  };

  // --- STATS GLOBALES ---
  const statsGlobales = useMemo(() => {
    return clients.reduce(
      (acc, client) => {
        acc.totalBLs += client.bls?.length || 0;
        acc.totalConteneurs += client.totalConteneursGlobal || 0;
        return acc;
      },
      { totalBLs: 0, totalConteneurs: 0 },
    );
  }, [clients]);

  // --- COMPTAGE PAR ONGLET ---
  const tabCounts = useMemo(
    () => ({
      tous: clients.length,
      crediteur: clients.filter((c) => (c.solde || 0) > 0).length,
      debiteur: clients.filter((c) => (c.solde || 0) < 0).length,
      regle: clients.filter((c) => (c.solde || 0) === 0).length,
    }),
    [clients],
  );

  // --- EXPORT EXCEL ---
  const exportToExcel = () => {
    if (filteredClients.length === 0) {
      toast.error("Aucune donnée à exporter");
      return;
    }
    const tabLabel = TABS.find((t) => t.key === activeTab)?.label || "Clients";
    const dataToExport = filteredClients.map((c) => ({
      "Nom du Client": c.nom?.toUpperCase(),
      "Code Client": c.codeClient,
      Contact: c.contact,
      Type: c.typeClient,
      "Dossiers BL": c.bls?.length || 0,
      "Total Conteneurs": c.totalConteneursGlobal || 0,
      "Solde (MRU)": c.solde || 0,
      Statut: c.restriction ? "Restreint" : "Actif",
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, tabLabel);
    XLSX.writeFile(
      workbook,
      `${tabLabel.replace(/ /g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    toast.success("Export Excel réussi");
  };

  // --- SUPPRESSION ---
  const handleDelete = async () => {
    if (!selectedClient) return;
    try {
      const url = API_PATHS.CLIENTS.DELETE_CLIENT.replace(
        ":id",
        selectedClient._id,
      );
      await API.delete(url);
      toast.success("Client supprimé avec succès");
      setIsDeleteOpen(false);
      setSelectedClient(null);
      fetchClients();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur de suppression");
    }
  };

  // --- FILTRES ---
  const filteredClients = useMemo(() => {
    let list = clients;
    if (activeTab === "crediteur")
      list = list.filter((c) => (c.solde || 0) > 0);
    else if (activeTab === "debiteur")
      list = list.filter((c) => (c.solde || 0) < 0);
    else if (activeTab === "regle")
      list = list.filter((c) => (c.solde || 0) === 0);

    const search = searchTerm.toLowerCase();
    if (search) {
      list = list.filter(
        (c) =>
          (c.nom || "").toLowerCase().includes(search) ||
          (c.contact || "").toLowerCase().includes(search) ||
          (c.codeClient || "").toLowerCase().includes(search),
      );
    }
    return list;
  }, [clients, searchTerm, activeTab]);

  const StatusBadge = ({ restricted }) =>
    restricted ? (
      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-red-500 bg-red-50 px-2 py-1 rounded-md border border-red-100">
        <ShieldAlert size={12} /> Restreint
      </span>
    ) : (
      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-500 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
        <ShieldCheck size={12} /> Actif
      </span>
    );

  if (isLoading)
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4">
        <div className="size-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Chargement des données...
        </p>
      </div>
    );

  return (
    <div className="max-w-[1400px] mx-auto p-6 lg:p-10 space-y-8 animate-fadeIn">
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Base Clients
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gérez vos relations et suivis financiers.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
            <input
              type="text"
              placeholder="Rechercher un nom, contact..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-red-500/5 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={exportToExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/10 transition-all active:scale-95"
          >
            <Download size={18} /> Exporter
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="bg-[#EF233C] hover:bg-[#D90429] text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-red-500/20 transition-all active:scale-95"
          >
            <UserPlus size={18} /> Nouveau Client
          </button>
        </div>
      </div>

      {/* STATS GLOBALES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="size-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Layers size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Total Dossiers BL
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {statsGlobales.totalBLs}
            </p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="size-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Box size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Total Conteneurs
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {statsGlobales.totalConteneurs}
            </p>
          </div>
        </div>
      </div>

      {/* ONGLETS */}
      <div className="flex items-center gap-2 bg-slate-100/70 p-1.5 rounded-2xl w-fit overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap
                ${
                  isActive
                    ? `${tab.activeBg} ${tab.activeText} shadow-sm border ${tab.activeBorder}`
                    : "text-slate-500 hover:text-slate-700 hover:bg-white/60"
                }
              `}
            >
              <Icon size={14} />
              {tab.label}
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                  isActive
                    ? `${tab.dot} text-white`
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {tabCounts[tab.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* TABLEAU */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-y-auto max-h-[500px] scrollbar-thin scrollbar-thumb-slate-200">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
              <tr className="text-[11px] font-black uppercase text-slate-400 tracking-widest">
                <th className="px-6 py-4">Nom du client</th>
                <th className="px-6 py-4">Code client</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4 text-center">Dossiers BL</th>
                <th className="px-6 py-4 text-center">Conteneurs</th>
                <th className="px-6 py-4 text-center">Solde</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Aucun client trouvé dans cet onglet
                    </p>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr
                    key={client._id}
                    onClick={() => handleRowClick(client)}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-400 border border-slate-200">
                          {(client.nom || "??").substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900 group-hover:text-red-600 transition-colors uppercase">
                            {client.nom}
                          </div>
                          <div className="text-[11px] font-bold text-slate-500 tracking-wider">
                            {client.contact}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-xs font-semibold text-slate-600">
                      {client.codeClient}
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                          client.typeClient === "Entreprise"
                            ? "bg-blue-50 text-blue-600"
                            : "bg-emerald-50 text-emerald-600"
                        }`}
                      >
                        {client.typeClient}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-sm font-bold text-slate-600">
                        <FileText size={14} className="text-slate-300" />
                        {client.bls?.length || 0}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center text-sm font-bold text-slate-600">
                      {client.totalConteneursGlobal || 0}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div
                        className={`text-sm font-black ${
                          (client.solde || 0) > 0
                            ? "text-red-500"
                            : (client.solde || 0) < 0
                              ? "text-emerald-500"
                              : "text-slate-400"
                        }`}
                      >
                        {new Intl.NumberFormat("fr-FR", {
                          style: "currency",
                          currency: "MRU",
                          maximumFractionDigits: 0,
                        }).format(client.solde || 0)}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <StatusBadge restricted={client.restriction} />
                    </td>
                    <td
                      className="px-6 py-5 text-right relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() =>
                          setActiveMenu(
                            activeMenu === client._id ? null : client._id,
                          )
                        }
                        className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
                      >
                        <MoreHorizontal size={20} />
                      </button>
                      {activeMenu === client._id && (
                        <div className="absolute right-10 top-12 w-44 bg-white border border-slate-100 rounded-xl shadow-xl z-50 py-2 animate-in zoom-in-95">
                          <button
                            onClick={() => {
                              setSelectedClient(client);
                              setIsUpdateOpen(true);
                              setActiveMenu(null);
                            }}
                            className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Edit2 size={14} className="text-indigo-500" />{" "}
                            Modifier
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => {
                                setSelectedClient(client);
                                setIsDeleteOpen(true);
                                setActiveMenu(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 size={14} /> Supprimer
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-slate-50 flex justify-between items-center bg-slate-50/30">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">
            Affichage de {filteredClients.length} clients sur {clients.length}{" "}
            au total
          </p>
        </div>
      </div>

      {/* MODALS */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Ajouter un Partenaire"
      >
        <CreateClientForm
          onCancel={() => setIsCreateOpen(false)}
          onSuccess={() => {
            setIsCreateOpen(false);
            fetchClients();
          }}
        />
      </Modal>

      <Modal
        isOpen={isUpdateOpen}
        onClose={() => setIsUpdateOpen(false)}
        title="Mise à jour Client"
      >
        <UpdateClientForm
          client={selectedClient}
          onCancel={() => setIsUpdateOpen(false)}
          onSuccess={() => {
            setIsUpdateOpen(false);
            fetchClients();
          }}
        />
      </Modal>

      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Confirmer la suppression"
      >
        <div className="p-4 bg-red-50 rounded-xl border border-red-100 mb-6 text-center">
          <p className="text-sm text-red-700 leading-relaxed">
            Supprimer <strong>{selectedClient?.nom}</strong> ?
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsDeleteOpen(false)}
            className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold text-sm"
          >
            Annuler
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold text-sm"
          >
            Confirmer
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default AllClients;
