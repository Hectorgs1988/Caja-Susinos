import { useMemo, useState } from "react";

const products = {
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

const allProducts = [...products.bebida, ...products.comida];

function toCurrency(value) {
    return value.toLocaleString("es-ES", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default function App() {
    const [category, setCategory] = useState("bebida");
    const [isTicketOpen, setTicketOpen] = useState(false);
    const [qtyById, setQtyById] = useState({});

    const productMap = useMemo(() => {
        return allProducts.reduce((acc, product) => {
            acc[product.id] = product;
            return acc;
        }, {});
    }, []);

    const activeProducts = products[category];

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
                return {
                    id,
                    name: product.name,
                    qty,
                    total: product.price * qty,
                };
            });
    }, [productMap, qtyById]);

    function addProduct(productId) {
        setQtyById((prev) => ({
            ...prev,
            [productId]: (prev[productId] || 0) + 1,
        }));
    }

    function clearOrder() {
        setQtyById({});
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
                <button className="admin-btn" type="button">
                    Admin
                </button>
            </header>

            <main className="content">
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
            </main>

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
                        <button
                            className="cta"
                            onClick={() => {
                                alert(`Comanda total: ${toCurrency(totalPrice)} EUR`);
                            }}
                            type="button"
                            disabled={totalItems === 0}
                        >
                            Cobrar
                        </button>
                    </div>
                </div>
            </aside>
        </div>
    );
}
