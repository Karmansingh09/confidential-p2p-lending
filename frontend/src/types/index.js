/**
 * Compact contract enum matching contracts/managed/contract/index.d.ts
 */
export var LoanStatus;
(function (LoanStatus) {
    LoanStatus[LoanStatus["requested"] = 0] = "requested";
    LoanStatus[LoanStatus["funded"] = 1] = "funded";
    LoanStatus[LoanStatus["repaid"] = 2] = "repaid";
    LoanStatus[LoanStatus["settled"] = 3] = "settled";
})(LoanStatus || (LoanStatus = {}));
