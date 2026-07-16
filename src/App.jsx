import { useEffect, useMemo, useState } from "react";

const INITIAL_PRODUCTS = {
    bebida: [
        { id: "cerveza", name: "Cerveza", price: 1.5 },
        { id: "tinto", name: "Vino Tinto", price: 1.5 },
        { id: "agua", name: "Agua", price: 1.0 },
        { id: "refresco", name: "Refresco", price: 1.5 },
        { id: "zumo", name: "Zumo", price: 1.5 },
        { id: "calimocho", name: "Vaso calimocho", price: 2.5 },
    ],
    comida: [
        { id: "pincho-tortilla", name: "Pincho tortilla", price: 2.0 },
        { id: "pincho-lomo", name: "Pincho lomo", price: 2.4 },
        { id: "gominolas", name: "Golosinas", price: 1.2 },
        { id: "bolsa-patatas", name: "Bolsa patatas", price: 1.5 },
        { id: "sandwich-mixto", name: "Sandwich mixto", price: 3.0 },
        { id: "chorizo", name: "Pincho chorizo", price: 2.2 },
    ],
};

const ORDERS_STORAGE_KEY = "caja.orders.v1";
const ADMIN_SESSION_KEY = "caja.admin.auth.v1";
const ADMIN_USER = import.meta.env.VITE_ADMIN_USER || "admin";
const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || "susinos123";
const VALE_TYPES = {
    "24": {
        id: "24",
        label: "Vale 24 EUR",
        rowsPerVale: 16,
        rowSlots: [
            { value: 30, count: 4 },
            { value: 10, count: 2 },
            { value: 5, count: 2 },
        ],
    },
    "12": {
        id: "12",
        label: "Vale 12 EUR",
        rowsPerVale: 10,
        rowSlots: [
            { value: 20, count: 5 },
            { value: 10, count: 1 },
            { value: 5, count: 2 },
        ],
    },
};

function normalizeProducts(source) {
    if (!source || !Array.isArray(source.bebida) || !Array.isArray(source.comida)) {
        return INITIAL_PRODUCTS;
    }

    return {
        bebida: source.bebida.filter(
            (p) => p && typeof p.id === "string" && typeof p.name === "string" && Number(p.price) >= 0
        ),
        comida: source.comida.filter(
            (p) => p && typeof p.id === "string" && typeof p.name === "string" && Number(p.price) >= 0
        ),
    };
}

function readOrdersFromStorage() {
    try {
        const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function buildProductId(name) {
    const slug = name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

    return `${slug || "producto"}-${Date.now()}`;
}

function toCurrency(value) {
    return value.toLocaleString("es-ES", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function toDateTime(value) {
    return new Date(value).toLocaleString("es-ES", {
        dateStyle: "short",
        timeStyle: "medium",
    });
}

function getRowValue(rowSlots) {
    return rowSlots.reduce((total, slot) => total + slot.value * slot.count, 0);
}

function getRowBreakdown(targetCents, rowSlots) {
    let remaining = targetCents;

    const items = rowSlots.map((slot, index) => {
        const isLastSlot = index === rowSlots.length - 1;
        const count = Math.min(
            slot.count,
            isLastSlot ? Math.ceil(remaining / slot.value) : Math.floor(remaining / slot.value)
        );

        remaining -= count * slot.value;

        return {
            value: slot.value,
            count,
        };
    });

    return {
        items,
        coveredCents: items.reduce((total, item) => total + item.value * item.count, 0),
    };
}

function formatBreakdownText(breakdown) {
    return breakdown.items
        .filter((item) => item.count > 0)
        .map((item) => `${item.count} de ${item.value}`)
        .join(" + ");
}

export default function App() {
    const [category, setCategory] = useState("bebida");
    const [isTicketOpen, setTicketOpen] = useState(false);
    const [qtyById, setQtyById] = useState({});
    const [productsByCategory, setProductsByCategory] = useState(INITIAL_PRODUCTS);
    const [orders, setOrders] = useState(readOrdersFromStorage);
    const [isAdminOpen, setAdminOpen] = useState(false);
    const [isAdminAuthenticated, setAdminAuthenticated] = useState(() => {
        try {
            return sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
        } catch {
            return false;
        }
    });
    const [isAuthOpen, setAuthOpen] = useState(false);
    const [authUser, setAuthUser] = useState("");
    const [authPass, setAuthPass] = useState("");
    const [authError, setAuthError] = useState("");
    const [adminTab, setAdminTab] = useState("products");
    const [newProduct, setNewProduct] = useState({
        name: "",
        price: "",
        category: "bebida",
    });
    const [editingById, setEditingById] = useState({});
    const [isPayingWithVale, setPayingWithVale] = useState(false);
    const [selectedValeType, setSelectedValeType] = useState("24");

    useEffect(() => {
        let isMounted = true;

        async function loadProducts() {
            try {
                const response = await fetch("/products.json", { cache: "no-store" });
                if (!response.ok) return;

                const parsed = await response.json();
                if (isMounted) {
                    setProductsByCategory(normalizeProducts(parsed));
                }
            } catch {
                // Keep fallback INITIAL_PRODUCTS if fetch fails.
            }
        }

        loadProducts();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
    }, [orders]);

    useEffect(() => {
        try {
            if (isAdminAuthenticated) {
                sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
            } else {
                sessionStorage.removeItem(ADMIN_SESSION_KEY);
            }
        } catch {
            // Ignore storage errors for private mode / blocked storage.
        }
    }, [isAdminAuthenticated]);

    const allProducts = useMemo(() => {
        return [
            ...productsByCategory.bebida.map((p) => ({ ...p, category: "bebida" })),
            ...productsByCategory.comida.map((p) => ({ ...p, category: "comida" })),
        ];
    }, [productsByCategory]);

    const productMap = useMemo(() => {
        return allProducts.reduce((acc, product) => {
            acc[product.id] = product;
            return acc;
        }, {});
    }, [allProducts]);

    const activeProducts = productsByCategory[category];

    const totalItems = useMemo(() => {
        return Object.values(qtyById).reduce((acc, qty) => acc + qty, 0);
    }, [qtyById]);

    const totalPrice = useMemo(() => {
        return Object.entries(qtyById).reduce((acc, [id, qty]) => {
            const product = productMap[id];
            return product ? acc + product.price * qty : acc;
        }, 0);
    }, [productMap, qtyById]);

    const ticketLines = useMemo(() => {
        return Object.entries(qtyById)
            .filter(([, qty]) => qty > 0)
            .map(([id, qty]) => {
                const product = productMap[id];
                if (!product) {
                    return null;
                }
                return {
                    id,
                    name: product.name,
                    qty,
                    total: product.price * qty,
                };
            })
            .filter(Boolean);
    }, [productMap, qtyById]);

    const salesSummary = useMemo(() => {
        return orders.reduce(
            (acc, order) => {
                acc.totalOrders += 1;
                acc.totalItems += order.items;
                acc.totalRevenue += order.total;
                return acc;
            },
            { totalOrders: 0, totalItems: 0, totalRevenue: 0 }
        );
    }, [orders]);

    const activeVale = VALE_TYPES[selectedValeType];

    const valeInfo = useMemo(() => {
        if (totalPrice <= 0 || !activeVale) return null;

        const totalCents = Math.round(totalPrice * 100);
        const targetCents = Math.ceil(totalCents / 5) * 5;
        const rowValueCents = getRowValue(activeVale.rowSlots);
        const fullRows = Math.floor(targetCents / rowValueCents);
        const partialRowCents = targetCents - fullRows * rowValueCents;
        const partialBreakdown = partialRowCents > 0 ? getRowBreakdown(partialRowCents, activeVale.rowSlots) : null;
        const rowsToCross = fullRows + (partialBreakdown ? 1 : 0);
        const partialText = partialBreakdown ? formatBreakdownText(partialBreakdown) : "";
        const instruction = fullRows > 0 && partialText
            ? `Tacha ${fullRows} ${fullRows === 1 ? "fila" : "filas"} + ${partialText}.`
            : partialText
              ? `Tacha ${partialText}.`
              : `Tacha ${rowsToCross} ${rowsToCross === 1 ? "fila" : "filas"}.`;

        return {
            instruction,
            label: activeVale.label,
        };
    }, [activeVale, totalPrice]);

    function addProduct(productId) {
        setQtyById((prev) => ({
            ...prev,
            [productId]: (prev[productId] || 0) + 1,
        }));
    }

    function clearOrder() {
        setQtyById({});
        setPayingWithVale(false);
    }

    function registerOrder() {
        if (totalItems === 0) return;

        const createdAt = new Date().toISOString();
        const order = {
            id: `order-${Date.now()}`,
            createdAt,
            items: totalItems,
            total: Number(totalPrice.toFixed(2)),
            lines: ticketLines.map((line) => ({
                id: line.id,
                name: line.name,
                qty: line.qty,
                total: Number(line.total.toFixed(2)),
            })),
        };

        setOrders((prev) => [order, ...prev]);
        setQtyById({});
        setPayingWithVale(false);
        setTicketOpen(false);
        alert(`Comanda registrada: ${toCurrency(order.total)} EUR`);
    }

    function startEditing(product) {
        setEditingById((prev) => ({
            ...prev,
            [product.id]: {
                name: product.name,
                price: String(product.price),
            },
        }));
    }

    function cancelEditing(productId) {
        setEditingById((prev) => {
            const next = { ...prev };
            delete next[productId];
            return next;
        });
    }

    function saveEditing(productId) {
        const draft = editingById[productId];
        if (!draft) return;

        const name = draft.name.trim();
        const price = Number(draft.price);

        if (!name || Number.isNaN(price) || price < 0) {
            alert("Revisa nombre y precio");
            return;
        }

        setProductsByCategory((prev) => ({
            bebida: prev.bebida.map((p) => (p.id === productId ? { ...p, name, price } : p)),
            comida: prev.comida.map((p) => (p.id === productId ? { ...p, name, price } : p)),
        }));

        cancelEditing(productId);
    }

    function deleteProduct(productId) {
        setProductsByCategory((prev) => ({
            bebida: prev.bebida.filter((p) => p.id !== productId),
            comida: prev.comida.filter((p) => p.id !== productId),
        }));

        setQtyById((prev) => {
            const next = { ...prev };
            delete next[productId];
            return next;
        });
    }

    function addNewProduct() {
        const name = newProduct.name.trim();
        const price = Number(newProduct.price);

        if (!name || Number.isNaN(price) || price < 0) {
            alert("Indica nombre y precio valido");
            return;
        }

        const item = {
            id: buildProductId(name),
            name,
            price,
        };

        setProductsByCategory((prev) => ({
            ...prev,
            [newProduct.category]: [...prev[newProduct.category], item],
        }));

        setNewProduct((prev) => ({ ...prev, name: "", price: "" }));
    }

    function closeAuthModal() {
        setAuthOpen(false);
        setAuthUser("");
        setAuthPass("");
        setAuthError("");
    }

    function handleAdminButton() {
        if (isAdminOpen) {
            setAdminOpen(false);
            return;
        }

        setTicketOpen(false);
        if (isAdminAuthenticated) {
            setAdminOpen(true);
            return;
        }

        setAuthOpen(true);
    }

    function submitAdminLogin(event) {
        event.preventDefault();

        if (authUser.trim() === ADMIN_USER && authPass === ADMIN_PASS) {
            setAdminAuthenticated(true);
            setAdminOpen(true);
            closeAuthModal();
            return;
        }

        setAuthError("Credenciales incorrectas");
    }

    function logoutAdmin() {
        setAdminAuthenticated(false);
        setAdminOpen(false);
        closeAuthModal();
    }

    return (
        <div className="app-shell">
            <header className="topbar">
                <div className="brand-wrap">
                    <div className="brand-badge"></div>
                    <div>
                        <p className="brand-kicker">Pena Los Mosquitos</p>
                        <h1>Susinos del Paramo</h1>
                    </div>
                </div>
                <button
                    className="admin-btn"
                    onClick={handleAdminButton}
                    type="button"
                >
                    {isAdminOpen ? "Caja" : "Admin"}
                </button>
            </header>

            <main className="content">
                {isAdminOpen ? (
                    <section className="admin-panel" aria-label="Menu admin">
                        <div className="admin-auth-row">
                            <p>Sesion admin activa</p>
                            <button className="admin-action" type="button" onClick={logoutAdmin}>
                                Cerrar sesion
                            </button>
                        </div>
                        <div className="admin-segment">
                            <button
                                className={`segment-btn ${adminTab === "products" ? "is-active" : ""}`}
                                onClick={() => setAdminTab("products")}
                                type="button"
                            >
                                Productos
                            </button>
                            <button
                                className={`segment-btn ${adminTab === "orders" ? "is-active" : ""}`}
                                onClick={() => setAdminTab("orders")}
                                type="button"
                            >
                                Recuento
                            </button>
                        </div>

                        {adminTab === "products" ? (
                            <>
                                <div className="admin-add-row">
                                    <input
                                        className="admin-input"
                                        placeholder="Producto"
                                        type="text"
                                        value={newProduct.name}
                                        onChange={(event) =>
                                            setNewProduct((prev) => ({
                                                ...prev,
                                                name: event.target.value,
                                            }))
                                        }
                                    />
                                    <input
                                        className="admin-input"
                                        placeholder="Precio"
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        value={newProduct.price}
                                        onChange={(event) =>
                                            setNewProduct((prev) => ({
                                                ...prev,
                                                price: event.target.value,
                                            }))
                                        }
                                    />
                                    <select
                                        className="admin-input"
                                        value={newProduct.category}
                                        onChange={(event) =>
                                            setNewProduct((prev) => ({
                                                ...prev,
                                                category: event.target.value,
                                            }))
                                        }
                                    >
                                        <option value="bebida">Bebida</option>
                                        <option value="comida">Comida</option>
                                    </select>
                                    <button className="admin-action primary" onClick={addNewProduct} type="button">
                                        Anadir
                                    </button>
                                </div>

                                <ul className="admin-list">
                                    {allProducts.map((product) => {
                                        const draft = editingById[product.id];

                                        return (
                                            <li key={product.id}>
                                                <div className="admin-list-main">
                                                    {draft ? (
                                                        <>
                                                            <input
                                                                className="admin-input"
                                                                type="text"
                                                                value={draft.name}
                                                                onChange={(event) =>
                                                                    setEditingById((prev) => ({
                                                                        ...prev,
                                                                        [product.id]: {
                                                                            ...prev[product.id],
                                                                            name: event.target.value,
                                                                        },
                                                                    }))
                                                                }
                                                            />
                                                            <input
                                                                className="admin-input"
                                                                type="number"
                                                                step="0.1"
                                                                min="0"
                                                                value={draft.price}
                                                                onChange={(event) =>
                                                                    setEditingById((prev) => ({
                                                                        ...prev,
                                                                        [product.id]: {
                                                                            ...prev[product.id],
                                                                            price: event.target.value,
                                                                        },
                                                                    }))
                                                                }
                                                            />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p className="admin-product-name">{product.name}</p>
                                                            <p className="admin-product-meta">
                                                                {product.category} · {toCurrency(product.price)} EUR
                                                            </p>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="admin-list-actions">
                                                    {draft ? (
                                                        <>
                                                            <button
                                                                className="admin-action primary"
                                                                onClick={() => saveEditing(product.id)}
                                                                type="button"
                                                            >
                                                                Guardar
                                                            </button>
                                                            <button
                                                                className="admin-action"
                                                                onClick={() => cancelEditing(product.id)}
                                                                type="button"
                                                            >
                                                                Cancelar
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                className="admin-action"
                                                                onClick={() => startEditing(product)}
                                                                type="button"
                                                            >
                                                                Editar
                                                            </button>
                                                            <button
                                                                className="admin-action danger"
                                                                onClick={() => deleteProduct(product.id)}
                                                                type="button"
                                                            >
                                                                Eliminar
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </>
                        ) : (
                            <>
                                <div className="admin-stats">
                                    <article>
                                        <p>Comandas</p>
                                        <strong>{salesSummary.totalOrders}</strong>
                                    </article>
                                    <article>
                                        <p>Articulos</p>
                                        <strong>{salesSummary.totalItems}</strong>
                                    </article>
                                    <article>
                                        <p>Facturacion</p>
                                        <strong>{toCurrency(salesSummary.totalRevenue)} EUR</strong>
                                    </article>
                                </div>

                                <ul className="admin-orders">
                                    {orders.length === 0 ? (
                                        <li className="empty">Aun no hay comandas registradas</li>
                                    ) : (
                                        orders.map((order) => (
                                            <li key={order.id}>
                                                <div className="admin-order-head">
                                                    <p>{toDateTime(order.createdAt)}</p>
                                                    <p>{toCurrency(order.total)} EUR</p>
                                                </div>
                                                <p className="admin-order-meta">{order.items} articulos</p>
                                                <ul>
                                                    {order.lines.map((line) => (
                                                        <li key={`${order.id}-${line.id}`}>
                                                            <span>{line.name}</span>
                                                            <span>
                                                                x{line.qty} · {toCurrency(line.total)} EUR
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </li>
                                        ))
                                    )}
                                </ul>
                            </>
                        )}
                    </section>
                ) : (
                    <>
                        <section className="segment" aria-label="Categorias">
                            <button
                                className={`segment-btn ${category === "bebida" ? "is-active" : ""}`}
                                onClick={() => setCategory("bebida")}
                                type="button"
                            >
                                Bebida
                            </button>
                            <button
                                className={`segment-btn ${category === "comida" ? "is-active" : ""}`}
                                onClick={() => setCategory("comida")}
                                type="button"
                            >
                                Comida
                            </button>
                        </section>

                        <section className="product-grid" aria-live="polite">
                            {activeProducts.map((product) => {
                                const qty = qtyById[product.id] || 0;

                                return (
                                    <button
                                        className={`product-card ${qty > 0 ? "has-qty" : ""}`}
                                        key={product.id}
                                        onClick={() => addProduct(product.id)}
                                        type="button"
                                    >
                                        <p className="product-name">{product.name}</p>
                                        <div className="product-price-row">
                                            <p className="product-price">{toCurrency(product.price)}</p>
                                            <span className="product-unit">EUR</span>
                                            {qty > 0 ? <span className="qty-chip">x{qty}</span> : null}
                                        </div>
                                    </button>
                                );
                            })}
                        </section>
                    </>
                )}
            </main>

            {!isAdminOpen ? (
                <aside className={`ticket ${isTicketOpen ? "is-open" : ""}`}>
                    <button
                        className="ticket-grab"
                        onClick={() => setTicketOpen((prev) => !prev)}
                        type="button"
                        aria-expanded={isTicketOpen}
                        aria-label={isTicketOpen ? "Cerrar comanda" : "Abrir comanda"}
                    >
                        <span />
                    </button>

                    <button
                        className="ticket-summary"
                        onClick={() => setTicketOpen((prev) => !prev)}
                        type="button"
                        aria-expanded={isTicketOpen}
                    >
                        <div>
                            <p className="ticket-kicker">Ver comanda</p>
                            <p className="ticket-items">{totalItems} articulos</p>
                        </div>
                        <p className="ticket-total">{toCurrency(totalPrice)} EUR</p>
                    </button>

                    <div className="ticket-body">
                        <ul className="ticket-list">
                            {ticketLines.length > 0 ? (
                                ticketLines.map((line) => (
                                    <li key={line.id}>
                                        <span className="name">{line.name}</span>
                                        <span className="meta">x{line.qty}</span>
                                        <span>{toCurrency(line.total)} EUR</span>
                                    </li>
                                ))
                            ) : (
                                <li className="empty">
                                    <span className="name">Aun no hay productos</span>
                                </li>
                            )}
                        </ul>

                        <div className="ticket-actions">
                            <button
                                className={`ghost pay-mode-btn ${isPayingWithVale ? "is-active" : ""}`}
                                onClick={() => setPayingWithVale((prev) => !prev)}
                                type="button"
                                disabled={totalItems === 0}
                            >
                                Pagar con vale
                            </button>
                            <button className="ghost" onClick={clearOrder} type="button">
                                Vaciar
                            </button>
                            <button className="cta" onClick={registerOrder} type="button" disabled={totalItems === 0}>
                                Cobrar
                            </button>
                        </div>

                        {isPayingWithVale && valeInfo ? (
                            <section className="vale-summary" aria-live="polite">
                                <div className="vale-type-selector" role="group" aria-label="Tipo de vale">
                                    {Object.values(VALE_TYPES).map((vale) => (
                                        <button
                                            key={vale.id}
                                            className={`vale-type-btn ${selectedValeType === vale.id ? "is-active" : ""}`}
                                            onClick={() => setSelectedValeType(vale.id)}
                                            type="button"
                                        >
                                            {vale.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="vale-total">Total: {toCurrency(totalPrice)} EUR</p>
                                <p>{valeInfo.instruction}</p>
                            </section>
                        ) : null}
                    </div>
                </aside>
            ) : null}

            {isAuthOpen ? (
                <div className="auth-backdrop" role="presentation" onClick={closeAuthModal}>
                    <section className="auth-card" role="dialog" aria-label="Acceso admin" onClick={(e) => e.stopPropagation()}>
                        <h2>Acceso admin</h2>
                        <p>Introduce usuario y contrasena para abrir el panel.</p>

                        <form onSubmit={submitAdminLogin}>
                            <input
                                className="admin-input"
                                type="text"
                                autoComplete="username"
                                placeholder="Usuario"
                                value={authUser}
                                onChange={(event) => setAuthUser(event.target.value)}
                            />
                            <input
                                className="admin-input"
                                type="password"
                                autoComplete="current-password"
                                placeholder="Contrasena"
                                value={authPass}
                                onChange={(event) => setAuthPass(event.target.value)}
                            />

                            {authError ? <p className="auth-error">{authError}</p> : null}

                            <div className="auth-actions">
                                <button className="admin-action" type="button" onClick={closeAuthModal}>
                                    Cancelar
                                </button>
                                <button className="admin-action primary" type="submit">
                                    Entrar
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            ) : null}
        </div>
    );
}
