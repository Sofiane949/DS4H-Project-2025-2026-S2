/**
 * <app-navbar> — Barre de navigation partagee entre les pages
 *
 * Usage :
 *   <script type="module" src="./navbar.js"></script>
 *   <app-navbar></app-navbar>
 */

const PAGES = [
    { href: 'index.html',      label: 'Chainage' },
    { href: 'audio.html',      label: 'Audio' },
    { href: 'sequencer.html',  label: 'Sequenceur' },
];

class AppNavbar extends HTMLElement {

    connectedCallback() {
        const current = location.pathname.split('/').pop() || 'index.html';

        const links = PAGES.map(p => {
            const active = (p.href === current) ? ' active' : '';
            return `<a class="nav-link${active}" href="${p.href}">${p.label}</a>`;
        }).join('');

        this.innerHTML = `
            <nav class="app-nav">
                <span class="nav-brand">ISF Renderer</span>
                <div class="nav-links">${links}</div>
            </nav>
        `;
    }
}

// ── Styles injectes une seule fois dans le document ──────────────────────────

if (!document.getElementById('app-navbar-styles')) {
    const style = document.createElement('style');
    style.id = 'app-navbar-styles';
    style.textContent = `
        .app-nav {
            display: flex;
            align-items: center;
            gap: 24px;
            padding: 10px 24px;
            background: linear-gradient(135deg, #0d0d22 0%, #141430 100%);
            border-bottom: 1px solid #1e1e40;
            font-family: 'Segoe UI', system-ui, sans-serif;
            position: sticky;
            top: 0;
            z-index: 1000;
            backdrop-filter: blur(12px);
        }

        .nav-brand {
            font-size: 13px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 2.5px;
            background: linear-gradient(135deg, #e0506a, #ff8090);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            flex-shrink: 0;
        }

        .nav-links {
            display: flex;
            gap: 4px;
            margin-left: auto;
        }

        .nav-link {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #5060a0;
            text-decoration: none;
            padding: 6px 14px;
            border-radius: 6px;
            transition: background 0.2s, color 0.2s, box-shadow 0.2s;
        }

        .nav-link:hover {
            background: #1a1a3a;
            color: #8898e0;
        }

        .nav-link.active {
            background: linear-gradient(135deg, #e0506a22, #e0506a11);
            color: #e0506a;
            box-shadow: inset 0 0 0 1px #e0506a44;
        }
    `;
    document.head.appendChild(style);
}

customElements.define('app-navbar', AppNavbar);
