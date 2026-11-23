"""UPS form fields transcribed from UPS_Specs_Dropdown_Options.pdf.

Only documented B/L values are offered as suggestions. The PDF's speculative
T values are not presented as confirmed options; buyers' exact values can be
entered in the editable dropdowns.
"""


def field(key, label, options=(), required=False, kind="text"):
    return {"key": key, "label": label, "options": list(options), "required": required, "kind": kind}


YES_NO = ("Yes", "No")
ONLINE_BASE = [
    field("rating", "Rating (KVA)", ("1", "3", "5"), True),
    field("input_voltage", "Input Voltage", ("Single Phase, 160V - 260V",), True),
    field("output_voltage", "Output Voltage", ("Single Phase, 230V ±1%",), True),
    field("isolation_transformer", "Inbuilt Isolation Transformer", YES_NO, True),
    field("overload", "Minimum Overload Capacity", ("120% of Rating in KVA for 10 minutes", "150% of Rating in KVA for 60 seconds"), True),
    field("mounting", "Type of Mounting", ("Floor Standing",), True),
    field("ingress", "Ingress Protection", ("IP20", "IP21 or higher"), True),
    field("temperature_lower", "Operating Temperature — Lower Limit", ("-5°C to 0°C", "5°C to 10°C"), True),
    field("temperature_upper", "Operating Temperature — Upper Limit", ("35°C to 40°C", "45°C to 50°C"), True),
    field("warranty", "Minimum Standard Warranty", ("1 year", "2 years"), True),
]
BATTERY = [
    field("battery_type", "Type of Battery", ("SMF-VRLA (Sealed Maintenance Free-Valve Regulated Lead Acid)", "Stationary Lead Acid Batteries"), True),
    field("backup", "Backup Time (Minutes)", ("15", "60", "90", "120", "240"), True),
    field("battery_capacity", "Battery Capacity (Ah)", ("9", "45", "65")),
]
EXTRAS = [
    field("additional_specs", "Additional Specification Parameters / Buyer ATC", kind="textarea"),
    field("special_terms", "Special Terms & Conditions", kind="textarea"),
    field("accessories", "Standard Accessories", kind="textarea"),
    field("protection_details", "Protection Details", kind="textarea"),
    field("metering", "Metering", kind="textarea"),
    field("alarms", "Alarms", kind="textarea"),
    field("humidity", "Minimum Relative Humidity (%)", ("85",)),
    field("test_report", "Test Report / Type of Laboratory", ("Govt. Lab / NABL / ILAC accredited for UPS testing",)),
    field("furnish_reports", "Agreed to Furnish Test Reports and Certificates on Demand", ("Yes",)),
    field("bis", "BIS Required", ("Yes",)),
]
LINE = [
    field("rating", "UPS Rating (KVA)", ("0.5", "0.6", "0.65", "0.8", "1.0", "1.5", "2.0", "3 or higher"), True),
    field("inverter", "Inverter Technology", ("MOSFET-PWM",), True),
    field("efficiency", "Inverter Efficiency (%)", ("60% or better", "70% or better"), True),
    field("backup", "Minimum Guaranteed Battery Backup at Full Load (Minutes)", ("5", "10", "15", "30", "60", "90", "120", "180", "240", "240 or higher"), True),
    field("battery_location", "Battery Location", ("Inside the Enclosure of UPS", "Outside the Enclosure of UPS"), True),
    field("warranty", "Standard Warranty for the UPS", ("1 year", "3 years", "5 years"), True),
    field("battery_type", "Type of Battery", ("SMF / VRLA", "Tubular (flooded lead acid)", "Lithium-ion / LiFePO4"), True),
    field("battery_capacity", "Battery Capacity (Ah)", ("7",)),
    field("vah", "Minimum Guaranteed VAH Capacity", ("84",)),
    field("battery_count", "Number of Batteries", ("1",)),
    field("battery_warranty", "Standard Warranty for the Battery", ("1 year", "2 years")),
    field("enclosure", "Enclosure Material", ("ABS", "Mild steel")),
    field("ingress", "Degree of Protection", ("IP20", "IP21")),
    field("output_voltage", "Rated Output Voltage and THD", ("Single Phase Quasi Sinewave 230 V AC 50 Hz, THD <=40%", "Single Phase Sinewave 230 V AC 50 Hz, THD <3%"), True),
    field("input_voltage", "Input Voltage Range", ("Single Phase AC (160-280V)",), True),
    field("salient_features", "Salient Features", (
        "Maximum 10 milliseconds switching over time", "Load power factor >=0.6",
        "+/-10% output voltage variation in battery mode", "<=0.5 Hz output frequency variation in battery mode",
        "10% overload for at least 10 minutes in mains mode", "10% overload for at least 5 minutes in mains mode",
    ), kind="multi"),
    field("avr_variation", "AVR Output Variation (AC Mode)", ("230 Volts +/-15%", "230 Volts +/-9%")),
    field("protections", "Standard Protection", ("Under voltage (input <160V)", "Overvoltage (input >280V)", "Short circuit of UPS", "Low battery", "Overload"), kind="multi"),
    field("environmental_reports", "Environmental Test Report Requirements", ("Dry heat: 45°C for 16 hours (IS:9000 pt-3/sec-5); Cold test (IS:9000 pt-2/sec-4)", "NA")),
    field("compliance", "Additional Compliance", ("As per MeitY (Government of India) guidelines", "Valid IS16242-Part 1 CRS certification"), kind="multi"),
    *[f for f in EXTRAS if f["key"] in ("test_report", "furnish_reports", "bis", "special_terms", "additional_specs")],
]


def online_fields(large=False, battery=True):
    fields = [dict(f) for f in ONLINE_BASE]
    if not battery:
        for spec in fields:
            if spec["key"] == "mounting":
                spec["options"] = ["Floor Standing", "Rack Mountable"]
            if spec["key"] == "output_voltage":
                spec["options"] = [
                    "Single Phase, 230V±1%",
                    "Three Phase, 400V±1% (Alternative User-settable to 380V±1%)",
                    "Three Phase, 415V±1% (Variable range: 380V - 415V)",
                ]
    if battery:
        for spec in fields:
            if spec["key"] == "mounting":
                spec["options"] = ["Floor Standing", "Tower", "Rack Mount", "Wall Mount"]
    if large:
        fields[0]["options"] = ["1", "10", "3", "5", "6", "7.5"] if not battery else ["15"]
        fields[1]["options"] = ["Single Phase, 160V - 260V", "Three Phase, 300V - 450V"]
    if battery:
        for spec in fields:
            if spec["key"] == "input_voltage":
                spec["options"] = [*spec["options"], "Three phase: 415V AC"]
            if spec["key"] == "output_voltage":
                spec["options"] = [*spec["options"], "Three phase output: 415V AC"]
    fields += [field("efficiency", "Overall Efficiency (%)", ("80% - 90%", "90% - 94%", ">=94%") if battery else ("80% - 90%", ">=90%"))]
    fields += [field("description", "UPS Description / Technology", ("IGBT-PWM",) if large and battery else (), kind="textarea")]
    if large and battery:
        fields += [field("thd", "Maximum THD at Linear Load", ("2%",))]
    if battery:
        battery_fields = [dict(f) for f in BATTERY]
        if large:
            battery_fields[1]["options"] = ["15", "60"]
            battery_fields[2]["options"] = ["42", "150"]
        fields += battery_fields
    return fields + EXTRAS


SCHEMAS = {
    "line_interactive": {"label": "Line Interactive UPS", "fields": LINE},
    "online_with_battery": {"label": "Online UPS With Battery", "fields": online_fields(), "large_fields": online_fields(large=True)},
    "online_without_battery": {"label": "Online UPS Without Battery", "fields": online_fields(large=True, battery=False)},
}
GENERAL_DOCS = [
    ("manufacturer_auth", "Manufacturer Authorization Certificate"),
    ("experience_certificate", "Experience Certificate"),
    ("past_performance", "Past Performance"),
    ("oem_annual_turnover", "OEM Annual Turnover"),
    ("atc_acceptance_letter", "ATC Acceptance Letter"),
    ("bidder_financial", "Bidder Financial Standing"),
    ("non_obsolete", "Non Obsolete"),
    ("non_malicious", "Non Malicious Code"),
    ("non_return_hdd", "Non Return of Hard Disk"),
    ("non_blacklisting", "Non Blacklisting"),
    ("service_support", "Service Support"),
    ("ipv6", "IPV6"),
    ("preloaded_os", "Preloaded Operating System"),
]

ANALYSER_DOCS = [
    ("warranty", "WARRANTY"),
    ("technical_compliance", "TECHNICAL COMPLIANCE"),
    ("data_sheet", "DATA SHEET"),
]


def specs_fields(ups_type, specs):
    schema = SCHEMAS[ups_type]
    return schema.get("large_fields", schema["fields"]) if specs.get("capacity_range") == "above_10" else schema["fields"]
