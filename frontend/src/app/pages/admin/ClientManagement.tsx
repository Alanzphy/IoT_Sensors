import { ChevronRight, Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { BentoCard } from "../../components/BentoCard";
import { PillButton } from "../../components/PillButton";
import { api } from "../../services/api";

interface Client {
  id: number;
  company_name: string;
  phone: string | null;
  address: string | null;
  user: {
    email: string;
    full_name: string;
    is_active: boolean;
  };
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function GlassInput({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-4 py-2.5 rounded-xl text-sm transition-all duration-200"
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid var(--border-glass)",
        color: "var(--text-primary)",
        outline: "none",
        ...props.style,
      }}
      onFocus={e => {
        e.target.style.borderColor = "var(--border-accent)";
        e.target.style.background = "rgba(255,255,255,0.07)";
        e.target.style.boxShadow = "0 0 0 3px rgba(143,175,122,0.1)";
      }}
      onBlur={e => {
        e.target.style.borderColor = "var(--border-glass)";
        e.target.style.background = "rgba(255,255,255,0.05)";
        e.target.style.boxShadow = "none";
      }}
    />
  );
}

export function ClientManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    company_name: "",
    email: "",
    full_name: "",
    password: "",
    phone: "",
    address: "",
  });

  const fetchClients = async () => {
    try {
      setLoading(true);
      const res = await api.get("/clients?per_page=100");
      setClients(res.data.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error cargando clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/clients", formData);
      setShowCreateForm(false);
      setFormData({ company_name: "", email: "", full_name: "", password: "", phone: "", address: "" });
      fetchClients();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Error creando cliente");
    }
  };

  const filtered = clients.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.company_name.toLowerCase().includes(term) ||
      (c.user?.email || "").toLowerCase().includes(term) ||
      (c.phone || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="flex items-start justify-between mb-7 animate-fade-in">
        <div>
          <h1 className="page-title text-gradient">Gestión de Clientes</h1>
          <p className="page-subtitle">Administra los clientes del sistema</p>
        </div>
        <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4" />
          Nuevo Cliente
        </PillButton>
      </div>

      {/* Search */}
      <div className="mb-5">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border-glass)",
          }}
        >
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Buscar por nombre, email o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent text-sm focus:outline-none"
            style={{ color: "var(--text-primary)" }}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} style={{ color: "var(--text-muted)" }}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl text-sm badge-danger w-full">
          {typeof error === "string" ? error : JSON.stringify(error)}
        </div>
      )}

      {/* Table — desktop */}
      <div className="hidden md:block animate-fade-in-up">
        <BentoCard variant="glass" padding="none" className="overflow-hidden">
          <table className="w-full table-dark">
            <thead>
              <tr>
                <th className="text-left">Empresa</th>
                <th className="text-left">Contacto</th>
                <th className="text-left">Email</th>
                <th className="text-left">Teléfono</th>
                <th className="text-left">Estado</th>
                <th className="text-right pr-5">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((__, j) => (
                      <td key={j}>
                        <div className="h-4 rounded shimmer" style={{ width: "70%" }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.map((client) => (
                <tr key={client.id}>
                  <td>
                    <span className="font-medium">{client.company_name}</span>
                  </td>
                  <td style={{ color: "var(--text-secondary)" }}>{client.user?.full_name || "—"}</td>
                  <td style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>
                    {client.user?.email || "—"}
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>{client.phone || "—"}</td>
                  <td>
                    <span className={client.user?.is_active ? "badge-active" : "badge-inactive"}>
                      {client.user?.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="text-right pr-5">
                    <Link to={`/admin/clientes/${client.id}/predios`}>
                      <PillButton variant="outline" className="text-xs px-3 py-1.5">
                        Predios <ChevronRight className="w-3 h-3" />
                      </PillButton>
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8" style={{ color: "var(--text-muted)" }}>
                    No hay clientes registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </BentoCard>
      </div>

      {/* Cards — mobile */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {loading && [...Array(3)].map((_, i) => (
          <div key={i} className="glass-card rounded-2xl h-[100px] shimmer" />
        ))}
        {!loading && filtered.map((client) => (
          <BentoCard key={client.id} variant="glass">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{client.company_name}</h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{client.user?.full_name}</p>
              </div>
              <span className={client.user?.is_active ? "badge-active" : "badge-inactive"}>
                {client.user?.is_active ? "Activo" : "Inactivo"}
              </span>
            </div>
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              {client.user?.email}
            </p>
            <Link to={`/admin/clientes/${client.id}/predios`}>
              <PillButton variant="outline" className="w-full text-xs">
                Ver Predios <ChevronRight className="w-3 h-3" />
              </PillButton>
            </Link>
          </BentoCard>
        ))}
      </div>

      {/* Create modal */}
      {showCreateForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
        >
          <div className="w-full max-w-md animate-fade-in-up">
            <BentoCard variant="glass">
              <div className="flex justify-between items-center mb-6">
                <h2 className="section-title">Nuevo Cliente</h2>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form className="space-y-4" onSubmit={handleCreate}>
                <FormField label="Nombre de la Empresa">
                  <GlassInput required type="text" value={formData.company_name} onChange={e => setFormData({ ...formData, company_name: e.target.value })} />
                </FormField>
                <FormField label="Nombre de Contacto">
                  <GlassInput required type="text" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} />
                </FormField>
                <FormField label="Email">
                  <GlassInput required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                </FormField>
                <FormField label="Contraseña Temporal">
                  <GlassInput required type="password" minLength={6} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                </FormField>
                <FormField label="Teléfono">
                  <GlassInput type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                </FormField>
                <FormField label="Dirección (Opcional)">
                  <GlassInput type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                </FormField>
                <div className="flex gap-3 pt-2">
                  <PillButton variant="ghost" className="flex-1" onClick={() => setShowCreateForm(false)} type="button">
                    Cancelar
                  </PillButton>
                  <PillButton variant="primary" className="flex-1" type="submit">
                    Guardar Cliente
                  </PillButton>
                </div>
              </form>
            </BentoCard>
          </div>
        </div>
      )}
    </div>
  );
}
