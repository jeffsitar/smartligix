const db = require("../db/database");
const { SERVICE_TYPES } = require("../config");

function getPricingSettings() {
    const rows = db.all("SELECT setting_key, setting_value FROM settings");
    const map = {};
    for (const r of rows) {
        map[r.setting_key] = r.setting_value;
    }
    return {
        companyName: map.company_name || "SmartLogix Global Logistics Pvt. Ltd.",
        currency: map.currency || "INR",
        baseRate: Number(map.base_rate || 450),
        perKgRate: Number(map.per_kg_rate || 38),
        fuelSurchargePct: Number(map.fuel_surcharge_pct || 12),
        gstPct: Number(map.gst_pct || 18),
        paymentTermsDays: Number(map.payment_terms_days || 15)
    };
}

function calculateFreightQuote({ weightKg = 1, serviceType = "STANDARD", declaredValue = 0 }) {
    const settings = getPricingSettings();
    const tier = SERVICE_TYPES[serviceType] || SERVICE_TYPES.STANDARD;
    const weight = Math.max(0.5, Number(weightKg) || 1);
    const declared = Math.max(0, Number(declaredValue) || 0);

    const baseCharge = round2(settings.baseRate * tier.multiplier);
    const weightCharge = round2(weight * settings.perKgRate * tier.multiplier);
    const insuranceFee = declared > 50000 ? round2(declared * 0.002) : 0;
    const subtotal = round2(baseCharge + weightCharge + insuranceFee);
    const fuelSurcharge = round2(subtotal * (settings.fuelSurchargePct / 100));
    const taxable = round2(subtotal + fuelSurcharge);
    const taxAmount = round2(taxable * (settings.gstPct / 100));
    const totalAmount = round2(taxable + taxAmount);

    return {
        serviceType: SERVICE_TYPES[serviceType] ? serviceType : "STANDARD",
        serviceLabel: tier.label,
        etaDays: tier.etaDays,
        currency: settings.currency,
        baseCharge,
        weightCharge,
        insuranceFee,
        fuelSurcharge,
        fuelSurchargePct: settings.fuelSurchargePct,
        taxAmount,
        gstPct: settings.gstPct,
        totalAmount
    };
}

function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

module.exports = {
    getPricingSettings,
    calculateFreightQuote
};
