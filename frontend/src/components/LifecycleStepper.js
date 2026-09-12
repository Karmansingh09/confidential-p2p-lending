import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { getLifecyclePhase } from '../lib/formatters.js';
export const LifecycleStepper = ({ loan }) => {
    const currentPhase = getLifecyclePhase(loan);
    const steps = [
        {
            phase: 'REQUESTED',
            title: '1. Requested',
            description: 'Terms initialized on-chain',
            isComplete: true, // Always completed once loan exists
            isCurrent: currentPhase === 'REQUESTED',
        },
        {
            phase: 'ELIGIBILITY_VERIFIED',
            title: '2. ZK Verified',
            description: 'Off-chain proof accepted',
            isComplete: loan.isEligibilityVerified &&
                ['ELIGIBILITY_VERIFIED', 'FUNDED', 'REPAID', 'SETTLED'].includes(currentPhase),
            isCurrent: currentPhase === 'ELIGIBILITY_VERIFIED',
        },
        {
            phase: 'FUNDED',
            title: '3. Funded',
            description: 'Lender capital committed',
            isComplete: ['FUNDED', 'REPAID', 'SETTLED'].includes(currentPhase),
            isCurrent: currentPhase === 'FUNDED',
        },
        {
            phase: 'REPAID',
            title: '4. Repaid',
            description: 'Principal + interest satisfied',
            isComplete: ['REPAID', 'SETTLED'].includes(currentPhase),
            isCurrent: currentPhase === 'REPAID',
        },
        {
            phase: 'SETTLED',
            title: '5. Settled',
            description: 'Terminal agreement closed',
            isComplete: currentPhase === 'SETTLED',
            isCurrent: currentPhase === 'SETTLED',
        },
    ];
    return (_jsxs("div", { className: "lifecycle-stepper-container", children: [_jsxs("div", { className: "lifecycle-header", children: [_jsx("h3", { children: "Protocol Lifecycle Progression" }), _jsxs("span", { className: "current-phase-indicator", children: ["Current: ", _jsx("strong", { children: currentPhase })] })] }), _jsx("div", { className: "stepper-track", children: steps.map((step, idx) => (_jsxs("div", { className: `stepper-step ${step.isComplete ? 'complete' : ''} ${step.isCurrent ? 'current' : ''}`, children: [_jsx("div", { className: "step-circle", children: step.isComplete && !step.isCurrent ? (_jsx("span", { children: "\u2713" })) : (_jsx("span", { children: idx + 1 })) }), _jsxs("div", { className: "step-content", children: [_jsx("div", { className: "step-title", children: step.title }), _jsx("div", { className: "step-desc", children: step.description })] }), idx < steps.length - 1 && _jsx("div", { className: "step-connector" })] }, step.phase))) })] }));
};
