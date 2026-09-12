import { jsx as _jsx } from "react/jsx-runtime";
import { DashboardPage } from './pages/DashboardPage.js';
import './App.css';
export const App = () => {
    return (_jsx("div", { className: "app-root", children: _jsx(DashboardPage, {}) }));
};
export default App;
