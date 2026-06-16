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

const PRODUCTS_STORAGE_KEY = "caja.products.v1";
const ORDERS_STORAGE_KEY = "caja.orders.v1";

function readProductsFromStorage() {
    try {
        const raw = localStorage.getItem(PRODUCTS_STORAGE_KEY);
        if (!raw) return INITIAL_PRODUCTS;

        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.bebida) || !Array.isArray(parsed.comida)) {
            return INITIAL_PRODUCTS;
        }

        return {
            bebida: parsed.bebida.filter(
                (p) => p && typeof p.id === "string" && typeof p.name === "string" && Number(p.price) >= 0
            ),
            comida: parsed.comida.filter(
                (p) => p && typeof p.id === "string" && typeof p.name === "string" && Number(p.price) >= 0
            ),
        };
    } catch {
        return INITIAL_PRODUCTS;
    }
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

export default function App() {
    const [category, setCategory] = useState("bebida");
    const [isTicketOpen, setTicketOpen] = useState(false);
    const [qtyById, setQtyById] = useState({});
    const [productsByCategory, setProductsByCategory] = useState(readProductsFromStorage);
    const [orders, setOrders] = useState(readOrdersFromStorage);
    const [isAdminOpen, setAdminOpen] = useState(false);
    const [adminTab, setAdminTab] = useState("products");
    const [newProduct, setNewProduct] = useState({
        name: "",
        price: "",
        category: "bebida",
    });
    const [editingById, setEditingById] = useState({});

    useEffect(() => {
        localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(productsByCategory));
    }, [productsByCategory]);

    useEffect(() => {
        localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
    }, [orders]);

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

    function addProduct(productId) {
        setQtyById((prev) => ({
            ...prev,
            [productId]: (prev[productId] || 0) + 1,
        }));
    }

    function clearOrder() {
        setQtyById({});
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
                    onClick={() => {
                        setAdminOpen((prev) => !prev);
                        setTicketOpen(false);
                    }}
                    type="button"
                >
                    {isAdminOpen ? "Caja" : "Admin"}
                </button>
            </header>

            <main className="content">
                {isAdminOpen ? (
                    <section className="admin-panel" aria-label="Menu admin">
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
                            <button className="ghost" onClick={clearOrder} type="button">
                                Vaciar
                            </button>
                            <button className="cta" onClick={registerOrder} type="button" disabled={totalItems === 0}>
                                Cobrar
                            </button>
                        </div>
                    </div>
                </aside>
            ) : null}
        </div>
    );
}
