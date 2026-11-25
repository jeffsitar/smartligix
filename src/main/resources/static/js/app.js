// Shared SmartLogix helper exports for backward compatibility
window.getStatusBadge = function (status) {
    return window.SLX ? window.SLX.getStatusBadge(status) : status;
};
