import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  History,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCcw,
  Download,
  X,
  Calendar,
} from "lucide-react";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import API from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";

const Liquidations = () => {
  const [activeTab, setActiveTab] = useState("credit");
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [processing, setProcessing] = useState(false);

  // --- ÉTATS FILTRES DATE ---
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");

  // --- DATE DE REMBOURSEMENT (modal) ---
  // Initialisée à aujourd'hui, modifiable par l'utilisateur
  const todayISO = () => new Date().toISOString().split("T")[0];
  const [dateRemboursement, setDateRemboursement] = useState(todayISO());

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const url =
        activeTab === "credit"
          ? API_PATHS.LIQUIDATION.GET_ALL_LIQUIDATION_DOUANE
          : API_PATHS.LIQUIDATION.GET_ONE_LIQUIDATION_ESPECES;

      const response = await API.get(url);
      const result = response.data?.data || response.data || [];
      setData(Array.isArray(result) ? result : []);
    } catch (error) {
      toast.error(error.message || "Erreur de récupération");
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    setDateDebut("");
    setDateFin("");
    setSearchTerm("");
  }, [activeTab]);

  const stats = useMemo(() => {
    if (!Array.isArray(data))
      return {
        paye: 0,
        aRembourser: 0,
        totalHistorique: 0,
        historiqueCredit: 0,
        historiqueEspece: 0,
      };

    return data.reduce(
      (acc, item) => {
        const montant = parseFloat(item.montant) || 0;
        const typeNormalise = item.typePaiement
          ? item.typePaiement
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
          : "";

        if (item.isCreditDouane === true) {
          acc.aRembourser += montant;
        } else {
          acc.paye += montant;
        }

        acc.totalHistorique += montant;

        if (typeNormalise.includes("credit")) {
          acc.historiqueCredit += montant;
        } else if (typeNormalise.includes("espece")) {
          acc.historiqueEspece += montant;
        }

        return acc;
      },
      {
        paye: 0,
        aRembourser: 0,
        totalHistorique: 0,
        historiqueCredit: 0,
        historiqueEspece: 0,
      },
    );
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchSearch =
        item.numBl?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.numLiquidation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.nomClient?.toLowerCase().includes(searchTerm.toLowerCase());

      const itemDate = item.datePaiement ? new Date(item.datePaiement) : null;
      const debut = dateDebut ? new Date(dateDebut) : null;
      const fin = dateFin ? new Date(dateFin + "T23:59:59") : null;

      const matchDebut = debut && itemDate ? itemDate >= debut : true;
      const matchFin = fin && itemDate ? itemDate <= fin : true;

      return matchSearch && matchDebut && matchFin;
    });
  }, [data, searchTerm, dateDebut, dateFin]);

  const hasDateFilter = dateDebut || dateFin;
  const resetDateFilter = () => {
    setDateDebut("");
    setDateFin("");
  };

  // --- EXPORT EXCEL ---
  const exportToExcel = () => {
    if (filteredData.length === 0) {
      toast.error("Aucune donnée à exporter");
      return;
    }
    const tabLabel =
      activeTab === "credit" ? "A_Rembourser" : "Liquidations_Payees";
    const dataToExport = filteredData.map((item) => ({
      Date: new Date(item.datePaiement).toLocaleDateString("fr-FR"),
      Heure: new Date(item.datePaiement).toLocaleTimeString("fr-FR"),
      "Num Liquidation": item.numLiquidation || "",
      "Num BL": item.numBl || "",
      "Nom Client": item.nomClient || "",
      "Montant (MRU)": parseFloat(item.montant) || 0,
      Règlement: item.typePaiement || "",
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, tabLabel);
    const suffix =
      dateDebut && dateFin
        ? `_${dateDebut}_au_${dateFin}`
        : dateDebut
          ? `_depuis_${dateDebut}`
          : dateFin
            ? `_jusqu_${dateFin}`
            : `_${new Date().toISOString().split("T")[0]}`;
    XLSX.writeFile(workbook, `${tabLabel}${suffix}.xlsx`);
    toast.success("Export Excel réussi");
  };

  // --- OUVRIR LE MODAL ---
  const openModal = (item) => {
    setSelectedItem(item);
    setDateRemboursement(todayISO()); // reset à aujourd'hui à chaque ouverture
    setIsModalOpen(true);
  };

  // --- ACTION PRINCIPALE ---
  const handleAction = async () => {
    if (!selectedItem) return;
    setProcessing(true);
    try {
      if (activeTab === "credit") {
        // On envoie la date choisie dans le body
        const url = API_PATHS.LIQUIDATION.PAYER_LIQUIDATION.replace(
          ":id_bl",
          selectedItem.id_bl,
        ).replace(":id_charge", selectedItem.id_charge);

        await API.patch(url, { dateRemboursement }); // ← date envoyée au backend

        toast.success("Remboursement effectué");
      } else {
        const url = API_PATHS.LIQUIDATION.ANNULER_LIQUIDATION.replace(
          ":id_bl",
          selectedItem.id_bl,
        ).replace(":id_charge", selectedItem.id_charge);

        await API.patch(url);
        toast.success("Annulation réussie");
      }

      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(
        error.response?.data?.message || error.message || "Erreur opération",
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto p-6 lg:p-10 space-y-8 animate-fadeIn text-slate-900">
      {/* STATS CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl flex flex-col justify-center">
          <h1 className="text-2xl font-black relative z-10">
            <span className="text-red-500">Liquidation</span>
          </h1>
          <RefreshCcw
            size={80}
            className="absolute -right-5 -bottom-5 text-white/5 rotate-12"
          />
        </div>

        {activeTab === "credit" ? (
          <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm lg:col-span-3 flex gap-8 items-center">
            <div className="flex-1">
              <Wallet className="text-red-600 mb-2" size={20} />
              <div className="text-2xl font-black">
                {stats.aRembourser.toLocaleString()}{" "}
                <span className="text-xs text-slate-400">MRU</span>
              </div>
              <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">
                Dette Crédit Douane
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm">
              <History className="text-slate-900 mb-2" size={20} />
              <div className="text-xl font-black">
                {stats.totalHistorique.toLocaleString()}{" "}
                <span className="text-xs text-slate-400">MRU</span>
              </div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Total Historique
              </span>
            </div>
            <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm">
              <CheckCircle2 className="text-amber-600 mb-2" size={20} />
              <div className="text-xl font-black">
                {stats.historiqueCredit.toLocaleString()}{" "}
                <span className="text-xs text-slate-400">MRU</span>
              </div>
              <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">
                Réglement Crédit
              </span>
            </div>
            <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm">
              <Wallet className="text-blue-600 mb-2" size={20} />
              <div className="text-xl font-black">
                {stats.historiqueEspece.toLocaleString()}{" "}
                <span className="text-xs text-slate-400">MRU</span>
              </div>
              <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">
                Réglement Espèces
              </span>
            </div>
          </>
        )}
      </div>

      {/* TABLEAU PRINCIPAL */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-50 shadow-sm space-y-5">
        {/* LIGNE 1 : Onglets + Recherche + Export */}
        <div className="flex justify-between items-end gap-4">
          <div className="flex gap-6 border-b border-slate-100">
            {[
              { id: "credit", label: "À Rembourser" },
              { id: "espece", label: "Liquidation Payé" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-4 text-xs font-black uppercase tracking-widest transition-all ${
                  activeTab === tab.id
                    ? "border-b-2 border-red-600 text-slate-900"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-4 py-2 bg-slate-100 rounded-xl text-[10px] font-bold outline-none w-56 focus:ring-2 focus:ring-red-500/20"
              />
            </div>
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/10 transition-all active:scale-95"
            >
              <Download size={13} /> Exporter
            </button>
          </div>
        </div>

        {/* LIGNE 2 : Filtres par date */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
            Période :
          </span>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Du
            </span>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="text-[10px] font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Au
            </span>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="text-[10px] font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
            />
          </div>
          {hasDateFilter && (
            <button
              onClick={resetDateFilter}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
            >
              <X size={11} /> Réinitialiser
            </button>
          )}
          <span className="ml-auto text-[9px] font-black text-slate-400 uppercase tracking-widest">
            {filteredData.length} résultat{filteredData.length > 1 ? "s" : ""}
            {hasDateFilter && " · filtré"}
          </span>
        </div>

        {/* TABLEAU */}
        <div className="rounded-xl border border-slate-50 overflow-hidden">
          <div className="overflow-y-auto max-h-[480px] scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  <th className="px-6 py-5">Date</th>
                  <th className="px-6 py-5">Num Liquidation</th>
                  <th className="px-6 py-5">Num BL</th>
                  <th className="px-6 py-5">Nom Client</th>
                  <th className="px-6 py-5">Montant</th>
                  <th className="px-6 py-5">Règlement</th>
                  <th className="px-6 py-5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="size-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          Chargement...
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                        Aucune donnée trouvée
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-slate-50/50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="text-[11px] font-bold text-slate-900">
                          {new Date(item.datePaiement).toLocaleDateString(
                            "fr-FR",
                          )}
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium">
                          {new Date(item.datePaiement).toLocaleTimeString(
                            "fr-FR",
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[11px] font-black text-slate-900 uppercase">
                          {item.numLiquidation}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[11px] font-black text-slate-900 uppercase">
                          {item.numBl}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[11px] font-black text-slate-900 uppercase">
                          {item.nomClient}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-black text-[11px]">
                        {parseFloat(item.montant).toLocaleString()}{" "}
                        <span className="text-[9px] text-slate-400">MRU</span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${
                            item.typePaiement === "Credit Douane"
                              ? "bg-amber-50 text-amber-600 border-amber-100"
                              : "bg-blue-50 text-blue-600 border-blue-100"
                          }`}
                        >
                          {item.typePaiement}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {activeTab === "credit" ? (
                          <button
                            onClick={() => openModal(item)}
                            className="px-4 py-2 bg-red-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-red-100 hover:scale-105 transition-transform"
                          >
                            Régler
                          </button>
                        ) : item.typePaiement === "Credit Douane" ? (
                          <button
                            onClick={() => openModal(item)}
                            className="px-4 py-2 bg-slate-100 text-slate-600 hover:text-red-600 rounded-xl text-[9px] font-black uppercase transition-colors"
                          >
                            Annuler
                          </button>
                        ) : (
                          <span className="text-[9px] text-slate-300 font-bold uppercase italic">
                            Finalisé
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── MODAL DE CONFIRMATION ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 text-center animate-scaleIn">
            {/* Icône */}
            <div
              className={`size-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 ${
                activeTab === "credit" ? "bg-red-50" : "bg-slate-50"
              }`}
            >
              {activeTab === "credit" ? (
                <Wallet className="text-red-600" size={32} />
              ) : (
                <AlertCircle className="text-slate-600" size={32} />
              )}
            </div>

            {/* Titre */}
            <h3 className="text-2xl font-black text-slate-900 mb-2">
              {activeTab === "credit"
                ? "Confirmer Paiement"
                : "Annuler Remboursement"}
            </h3>

            {/* Info BL */}
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-6">
              BL: {selectedItem?.numBl} ·{" "}
              {parseFloat(selectedItem?.montant).toLocaleString()} MRU
            </p>

            {/* ── SÉLECTEUR DE DATE (seulement pour l'onglet "credit") ── */}
            {activeTab === "credit" && (
              <div className="mb-8">
                <div className="flex items-center gap-2 justify-center mb-2">
                  <Calendar size={13} className="text-slate-400" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Date du remboursement
                  </span>
                </div>
                <input
                  type="date"
                  value={dateRemboursement}
                  onChange={(e) => setDateRemboursement(e.target.value)}
                  max={todayISO()} // on ne peut pas saisir une date future
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-300 transition-all text-center cursor-pointer"
                />
                {dateRemboursement !== todayISO() && (
                  <p className="mt-2 text-[9px] font-bold text-amber-500 uppercase tracking-widest">
                    ⚠ Date antérieure à aujourd'hui
                  </p>
                )}
              </div>
            )}

            {/* Boutons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={processing}
                className="py-4 rounded-2xl font-black uppercase text-[10px] text-slate-400 border border-slate-100 hover:bg-slate-50 transition-colors"
              >
                Fermer
              </button>
              <button
                onClick={handleAction}
                disabled={
                  processing || (activeTab === "credit" && !dateRemboursement)
                }
                className={`py-4 rounded-2xl font-black uppercase text-[10px] text-white flex items-center justify-center gap-2 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed ${
                  activeTab === "credit"
                    ? "bg-red-600 shadow-red-200"
                    : "bg-slate-900 shadow-slate-200"
                }`}
              >
                {processing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Traitement...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} /> Confirmer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Liquidations;
