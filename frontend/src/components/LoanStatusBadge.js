import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const LoanStatusBadge = ({ statusText }) => {
    const getBadgeClass = (status) => {
        switch (status) {
            case 'requested':
                return 'badge-requested';
            case 'funded':
                return 'badge-funded';
            case 'repaid':
                return 'badge-repaid';
            case 'settled':
                return 'badge-settled';
            default:
                return 'badge-default';
        }
    };
    const getLabel = (status) => {
        switch (status) {
            case 'requested':
                return 'REQUESTED';
            case 'funded':
                return 'FUNDED';
            case 'repaid':
                return 'REPAID';
            case 'settled':
                return 'SETTLED (TERMINAL)';
            default:
                return String(status).toUpperCase();
        }
    };
    return (_jsxs("span", { className: `loan-status-badge ${getBadgeClass(statusText)}`, children: [_jsx("span", { className: "badge-dot" }), getLabel(statusText)] }));
};
