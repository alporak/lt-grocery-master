"use client";
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = GroceryListDetailPage;
var react_1 = require("react");
var navigation_1 = require("next/navigation");
var card_1 = require("@/components/ui/card");
var button_1 = require("@/components/ui/button");
var input_1 = require("@/components/ui/input");
var badge_1 = require("@/components/ui/badge");
var tabs_1 = require("@/components/ui/tabs");
var select_1 = require("@/components/ui/select");
var i18n_provider_1 = require("@/components/i18n-provider");
var lucide_react_1 = require("lucide-react");
var parse_item_1 = require("@/lib/parse-item");
var cost_1 = require("@/lib/cost");
var BrandPickerModal_1 = require("@/components/BrandPickerModal");
var ProductPreviewModal_1 = require("@/components/ProductPreviewModal");
var brandPreferences_1 = require("@/lib/brandPreferences");
var dietaryTags_1 = require("@/lib/dietaryTags");
function GroceryListDetailPage() {
    var _this = this;
    var _a, _b, _c;
    var params = (0, navigation_1.useParams)();
    var router = (0, navigation_1.useRouter)();
    var _d = (0, i18n_provider_1.useI18n)(), t = _d.t, language = _d.language;
    // Core data
    var _e = (0, react_1.useState)(null), list = _e[0], setList = _e[1];
    var _f = (0, react_1.useState)([]), allLists = _f[0], setAllLists = _f[1];
    var _g = (0, react_1.useState)(false), saving = _g[0], setSaving = _g[1];
    // Tab control
    var _h = (0, react_1.useState)("items"), activeTab = _h[0], setActiveTab = _h[1];
    // Inline rename
    var _j = (0, react_1.useState)(false), isRenaming = _j[0], setIsRenaming = _j[1];
    var _k = (0, react_1.useState)(""), renameValue = _k[0], setRenameValue = _k[1];
    var _l = (0, react_1.useState)(false), renameSaving = _l[0], setRenameSaving = _l[1];
    // Mass import
    var _m = (0, react_1.useState)(""), importText = _m[0], setImportText = _m[1];
    var _o = (0, react_1.useState)(null), importParsed = _o[0], setImportParsed = _o[1];
    var _p = (0, react_1.useState)(false), importAdding = _p[0], setImportAdding = _p[1];
    // Single-item add
    var _q = (0, react_1.useState)(""), newItem = _q[0], setNewItem = _q[1];
    var _r = (0, react_1.useState)("1"), newQty = _r[0], setNewQty = _r[1];
    var _s = (0, react_1.useState)([]), suggestions = _s[0], setSuggestions = _s[1];
    var _t = (0, react_1.useState)(false), showSuggestions = _t[0], setShowSuggestions = _t[1];
    var _u = (0, react_1.useState)(-1), selectedSuggestion = _u[0], setSelectedSuggestion = _u[1];
    var _v = (0, react_1.useState)(null), pickedSuggestion = _v[0], setPickedSuggestion = _v[1];
    var _w = (0, react_1.useState)(null), parsedPreview = _w[0], setParsedPreview = _w[1];
    var _x = (0, react_1.useState)(null), dominantCategory = _x[0], setDominantCategory = _x[1];
    var _y = (0, react_1.useState)(false), showBrandPicker = _y[0], setShowBrandPicker = _y[1];
    // Item list interaction
    var _z = (0, react_1.useState)(null), editingIndex = _z[0], setEditingIndex = _z[1];
    var _0 = (0, react_1.useState)(""), editQty = _0[0], setEditQty = _0[1];
    // Products tab
    var _1 = (0, react_1.useState)({}), productSuggestions = _1[0], setProductSuggestions = _1[1];
    var _2 = (0, react_1.useState)(false), productSuggestionsLoading = _2[0], setProductSuggestionsLoading = _2[1];
    var _3 = (0, react_1.useState)({}), categoryFilters = _3[0], setCategoryFilters = _3[1];
    // Cross-store similar picks keyed by itemName, populated when user pins a product.
    // Shape: { [itemName]: { [storeId]: StoreMatchLite[] } }
    var _4 = (0, react_1.useState)({}), similarByItem = _4[0], setSimilarByItem = _4[1];
    var _5 = (0, react_1.useState)(new Set()), similarLoading = _5[0], setSimilarLoading = _5[1];
    // Dietary filter for Products tab
    var _6 = (0, react_1.useState)(null), dietaryFilter = _6[0], setDietaryFilter = _6[1];
    // Auto-match loading indicator (by itemName)
    var _7 = (0, react_1.useState)(new Set()), autoMatchLoading = _7[0], setAutoMatchLoading = _7[1];
    // Price comparison
    var _8 = (0, react_1.useState)(null), compareResult = _8[0], setCompareResult = _8[1];
    var _9 = (0, react_1.useState)(false), comparing = _9[0], setComparing = _9[1];
    // Travel mode: €/km for distance penalty. 0 = ignore distance.
    var _10 = (0, react_1.useState)(0.3), travelCostPerKm = _10[0], setTravelCostPerKm = _10[1];
    var _11 = (0, react_1.useState)(new Set()), expandedItems = _11[0], setExpandedItems = _11[1];
    var _12 = (0, react_1.useState)({}), selectedCandidates = _12[0], setSelectedCandidates = _12[1];
    // Modals
    var _13 = (0, react_1.useState)(null), previewProductId = _13[0], setPreviewProductId = _13[1];
    // When non-null, opening preview from Products tab for this item — "Add to list" updates that item
    var _14 = (0, react_1.useState)(null), previewSourceItemName = _14[0], setPreviewSourceItemName = _14[1];
    var suggestRef = (0, react_1.useRef)(null);
    var inputRef = (0, react_1.useRef)(null);
    // Live parse hint shown while typing
    var liveHint = (function () {
        if (!newItem.trim() || pickedSuggestion)
            return null;
        var p = (0, parse_item_1.parseItem)(newItem.trim());
        if (p.name === newItem.trim() && p.quantity === 1 && !p.unit)
            return null;
        return "\u2192 \"".concat(p.name, "\"").concat(p.quantity !== 1 || p.unit ? " \u00D7 ".concat(p.quantity).concat(p.unit ? " " + p.unit : "") : "");
    })();
    var fetchList = (0, react_1.useCallback)(function () {
        if (!params.id)
            return;
        fetch("/api/grocery-lists/".concat(params.id))
            .then(function (r) { return r.json(); })
            .then(setList)
            .catch(function () { });
    }, [params.id]);
    (0, react_1.useEffect)(function () {
        fetchList();
        fetch("/api/grocery-lists")
            .then(function (r) { return r.json(); })
            .then(function (lists) {
            return setAllLists(lists.filter(function (l) { return l.id !== Number(params.id); }));
        })
            .catch(function () { });
    }, [fetchList, params.id]);
    // Auto-enter rename mode when navigated here with ?rename=1
    (0, react_1.useEffect)(function () {
        if (!list)
            return;
        if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("rename") === "1") {
            setIsRenaming(true);
            setRenameValue(list.name);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [list === null || list === void 0 ? void 0 : list.id]); // only fire once when list first loads
    // Restore cross-store similar picks for any items that already have pinnedProductId on load
    (0, react_1.useEffect)(function () {
        if (!list)
            return;
        var pinned = list.items.filter(function (i) { return typeof i.pinnedProductId === "number" && i.pinnedProductId > 0; });
        if (pinned.length === 0)
            return;
        (function () { return __awaiter(_this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.all(pinned.map(function (item) { return __awaiter(_this, void 0, void 0, function () {
                            var similar, numericKeyed_1, _i, _a, _b, k, v, _c;
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0:
                                        if (!item.pinnedProductId)
                                            return [2 /*return*/];
                                        _d.label = 1;
                                    case 1:
                                        _d.trys.push([1, 3, , 4]);
                                        return [4 /*yield*/, fetch("/api/products/similar", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ productId: item.pinnedProductId }),
                                            }).then(function (r) { return r.json(); })];
                                    case 2:
                                        similar = _d.sent();
                                        numericKeyed_1 = {};
                                        for (_i = 0, _a = Object.entries(similar); _i < _a.length; _i++) {
                                            _b = _a[_i], k = _b[0], v = _b[1];
                                            numericKeyed_1[Number(k)] = v;
                                        }
                                        setSimilarByItem(function (prev) {
                                            var _a;
                                            return (__assign(__assign({}, prev), (_a = {}, _a[item.itemName] = numericKeyed_1, _a)));
                                        });
                                        return [3 /*break*/, 4];
                                    case 3:
                                        _c = _d.sent();
                                        return [3 /*break*/, 4];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        }); }))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [list === null || list === void 0 ? void 0 : list.id]); // once on load
    // Autocomplete suggestions
    (0, react_1.useEffect)(function () {
        if (newItem.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        var timer = setTimeout(function () {
            var parsed = (0, parse_item_1.parseItem)(newItem.trim());
            var searchQuery = parsed.name.length >= 2 ? parsed.name : newItem.trim();
            fetch("/api/products/suggest?q=".concat(encodeURIComponent(searchQuery), "&limit=8"))
                .then(function (r) { return r.json(); })
                .then(function (data) {
                var suggs = Array.isArray(data) ? data : (data.suggestions || []);
                setSuggestions(suggs);
                setDominantCategory(Array.isArray(data) ? null : (data.dominantCategory || null));
                setShowSuggestions(suggs.length > 0);
                setSelectedSuggestion(-1);
            })
                .catch(function () { });
        }, 200);
        return function () { return clearTimeout(timer); };
    }, [newItem]);
    // Close suggestions on outside click
    (0, react_1.useEffect)(function () {
        var handleClick = function (e) {
            if (suggestRef.current && !suggestRef.current.contains(e.target) &&
                inputRef.current && !inputRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return function () { return document.removeEventListener("mousedown", handleClick); };
    }, []);
    var saveItems = function (items) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setSaving(true);
                    return [4 /*yield*/, fetch("/api/grocery-lists/".concat(params.id), {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ items: items }),
                        })];
                case 1:
                    _a.sent();
                    setSaving(false);
                    return [2 /*return*/];
            }
        });
    }); };
    var commitRename = function () { return __awaiter(_this, void 0, void 0, function () {
        var trimmed;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    trimmed = renameValue.trim();
                    if (!trimmed || !list || trimmed === list.name) {
                        setIsRenaming(false);
                        return [2 /*return*/];
                    }
                    setRenameSaving(true);
                    return [4 /*yield*/, fetch("/api/grocery-lists/".concat(params.id), {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name: trimmed }),
                        })];
                case 1:
                    _a.sent();
                    setList(__assign(__assign({}, list), { name: trimmed }));
                    setIsRenaming(false);
                    setRenameSaving(false);
                    return [2 /*return*/];
            }
        });
    }); };
    // Mass import
    var handlePreviewImport = function () {
        if (!importText.trim()) {
            setImportParsed(null);
            return;
        }
        var lines = importText
            .split("\n")
            .flatMap(parse_item_1.splitIngredientLine);
        setImportParsed(lines.map(function (raw) { return ({ raw: raw, parsed: (0, parse_item_1.parseItem)(raw) }); }));
    };
    var handleAddAll = function () { return __awaiter(_this, void 0, void 0, function () {
        var newItems, items;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!importParsed || !list)
                        return [2 /*return*/];
                    setImportAdding(true);
                    newItems = importParsed.map(function (_a) {
                        var parsed = _a.parsed;
                        return ({
                            itemName: parsed.name,
                            quantity: parsed.quantity,
                            unit: parsed.unit,
                            checked: false,
                        });
                    });
                    items = __spreadArray(__spreadArray([], list.items, true), newItems, true);
                    setList(__assign(__assign({}, list), { items: items }));
                    return [4 /*yield*/, saveItems(items)];
                case 1:
                    _a.sent();
                    setImportText("");
                    setImportParsed(null);
                    setImportAdding(false);
                    setProductSuggestions({});
                    return [2 /*return*/];
            }
        });
    }); };
    var addItem = function () { return __awaiter(_this, void 0, void 0, function () {
        var itemName, quantity, unit, parsed, items;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!newItem.trim() || !list)
                        return [2 /*return*/];
                    itemName = newItem.trim();
                    quantity = parseFloat(newQty) || 1;
                    unit = null;
                    if (!pickedSuggestion) {
                        parsed = (0, parse_item_1.parseItem)(itemName);
                        itemName = parsed.name;
                        quantity = parsed.quantity;
                        unit = parsed.unit;
                        if (parsed.name !== newItem.trim()) {
                            setParsedPreview((0, parse_item_1.formatParsed)(parsed));
                            setTimeout(function () { return setParsedPreview(null); }, 3000);
                        }
                    }
                    items = __spreadArray(__spreadArray([], list.items, true), [
                        { itemName: itemName, quantity: quantity, unit: unit, checked: false },
                    ], false);
                    setList(__assign(__assign({}, list), { items: items }));
                    setNewItem("");
                    setNewQty("1");
                    setPickedSuggestion(null);
                    setSuggestions([]);
                    setShowSuggestions(false);
                    setProductSuggestions({});
                    return [4 /*yield*/, saveItems(items)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    var pickSuggestion = function (s) {
        var _a;
        setNewItem(s.name);
        setPickedSuggestion(s);
        setSuggestions([]);
        setShowSuggestions(false);
        (_a = inputRef.current) === null || _a === void 0 ? void 0 : _a.focus();
    };
    var addSuggestionDirectly = function (s) { return __awaiter(_this, void 0, void 0, function () {
        var items;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!list)
                        return [2 /*return*/];
                    items = __spreadArray(__spreadArray([], list.items, true), [{ itemName: s.name, quantity: 1, unit: null, checked: false }], false);
                    setList(__assign(__assign({}, list), { items: items }));
                    setNewItem("");
                    setNewQty("1");
                    setPickedSuggestion(null);
                    setSuggestions([]);
                    setShowSuggestions(false);
                    setProductSuggestions({});
                    return [4 /*yield*/, saveItems(items)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    var handleInputKeyDown = function (e) {
        if (showSuggestions && suggestions.length > 0) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedSuggestion(function (prev) { return Math.min(prev + 1, suggestions.length - 1); });
            }
            else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedSuggestion(function (prev) { return Math.max(prev - 1, -1); });
            }
            else if (e.key === "Enter" && selectedSuggestion >= 0) {
                e.preventDefault();
                pickSuggestion(suggestions[selectedSuggestion]);
                return;
            }
            else if (e.key === "Escape") {
                setShowSuggestions(false);
                return;
            }
        }
        if (e.key === "Enter" && selectedSuggestion < 0) {
            addItem();
        }
    };
    var removeItem = function (index) { return __awaiter(_this, void 0, void 0, function () {
        var removed, items;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!list)
                        return [2 /*return*/];
                    removed = list.items[index];
                    items = list.items.filter(function (_, i) { return i !== index; });
                    setList(__assign(__assign({}, list), { items: items }));
                    setProductSuggestions({});
                    if (removed) {
                        setSimilarByItem(function (prev) {
                            var next = __assign({}, prev);
                            delete next[removed.itemName];
                            return next;
                        });
                    }
                    return [4 /*yield*/, saveItems(items)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    var updateItemQty = function (index, qty) { return __awaiter(_this, void 0, void 0, function () {
        var items;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!list || qty <= 0)
                        return [2 /*return*/];
                    items = list.items.map(function (item, i) {
                        return i === index ? __assign(__assign({}, item), { quantity: qty }) : item;
                    });
                    setList(__assign(__assign({}, list), { items: items }));
                    setEditingIndex(null);
                    return [4 /*yield*/, saveItems(items)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    var getQuantityPresets = function (s) {
        var _a;
        var unit = (_a = s.weightUnit) === null || _a === void 0 ? void 0 : _a.toLowerCase();
        if (unit === "kg" || unit === "g") {
            return [
                { value: 0.25, label: "250g" },
                { value: 0.5, label: "500g" },
                { value: 1, label: "1 kg" },
                { value: 2, label: "2 kg" },
            ];
        }
        if (unit === "l" || unit === "ml") {
            return [
                { value: 1, label: "1" },
                { value: 2, label: "2" },
                { value: 3, label: "3" },
                { value: 6, label: "6" },
            ];
        }
        return [
            { value: 1, label: "1" },
            { value: 2, label: "2" },
            { value: 3, label: "3" },
            { value: 5, label: "5" },
            { value: 10, label: "10" },
        ];
    };
    var toggleCheck = function (index) { return __awaiter(_this, void 0, void 0, function () {
        var items;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!list)
                        return [2 /*return*/];
                    items = list.items.map(function (item, i) {
                        return i === index ? __assign(__assign({}, item), { checked: !item.checked }) : item;
                    });
                    setList(__assign(__assign({}, list), { items: items }));
                    return [4 /*yield*/, saveItems(items)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    var comparePrices = function () { return __awaiter(_this, void 0, void 0, function () {
        var result, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!list || list.items.length === 0)
                        return [2 /*return*/];
                    setComparing(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, fetch("/api/compare", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                items: list.items.map(function (i) {
                                    var _a;
                                    return ({
                                        itemName: i.itemName,
                                        quantity: i.quantity,
                                        unit: i.unit || undefined,
                                        pinnedProductId: (_a = i.pinnedProductId) !== null && _a !== void 0 ? _a : undefined,
                                    });
                                }),
                                language: language,
                                travelCostPerKm: travelCostPerKm,
                            }),
                        }).then(function (r) { return r.json(); })];
                case 2:
                    result = _a.sent();
                    setCompareResult(result);
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _a.sent();
                    console.error(err_1);
                    return [3 /*break*/, 4];
                case 4:
                    setComparing(false);
                    return [2 /*return*/];
            }
        });
    }); };
    var exportList = function () {
        var _a;
        if (!list)
            return;
        var lines = ["".concat(list.name), "Exported: ".concat(new Date().toLocaleDateString()), ""];
        lines.push("ITEMS:");
        for (var _i = 0, _b = list.items; _i < _b.length; _i++) {
            var item = _b[_i];
            lines.push("  \u00D7".concat(item.quantity).concat(item.unit ? " " + item.unit : "", "  ").concat(item.itemName));
        }
        if (compareResult) {
            var smartRec_1 = (_a = compareResult.smartRecommendation) === null || _a === void 0 ? void 0 : _a[0];
            var best = smartRec_1
                ? compareResult.storeResults.find(function (s) { return s.storeId === smartRec_1.storeId; })
                : compareResult.storeResults.find(function (s) { return s.storeId === compareResult.cheapestStoreId; });
            if (best) {
                lines.push("");
                lines.push("RECOMMENDED STORE: ".concat(best.storeName, " \u2014 ").concat(best.totalCost.toFixed(2), "\u20AC"));
                for (var _c = 0, _d = best.items; _c < _d.length; _c++) {
                    var item = _d[_c];
                    if (item.match) {
                        lines.push("  ".concat(item.itemName, ": ").concat(item.match.productName, " \u2014 ").concat(item.lineCost.toFixed(2), "\u20AC"));
                    }
                    else {
                        lines.push("  ".concat(item.itemName, ": NOT FOUND"));
                    }
                }
            }
        }
        var blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "".concat(list.name.replace(/[^a-z0-9]/gi, "_"), ".txt");
        a.click();
        URL.revokeObjectURL(url);
    };
    var importFromList = function (sourceId) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch("/api/grocery-lists/".concat(params.id, "/import"), {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ sourceId: sourceId }),
                    })];
                case 1:
                    _a.sent();
                    fetchList();
                    setProductSuggestions({});
                    return [2 /*return*/];
            }
        });
    }); };
    var fetchProductSuggestions = function () { return __awaiter(_this, void 0, void 0, function () {
        var brandPrefs, results;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!list)
                        return [2 /*return*/];
                    setProductSuggestionsLoading(true);
                    brandPrefs = (0, brandPreferences_1.getBrandPreferences)();
                    results = {};
                    return [4 /*yield*/, Promise.all(list.items.map(function (item) { return __awaiter(_this, void 0, void 0, function () {
                            var res, suggestions, dominantCat, preferred;
                            var _a, _b;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0: return [4 /*yield*/, fetch("/api/products/suggest?q=".concat(encodeURIComponent(item.itemName), "&limit=12&nodedupe=1")).then(function (r) { return r.json(); })];
                                    case 1:
                                        res = _c.sent();
                                        suggestions = Array.isArray(res) ? res : (res.suggestions || []);
                                        dominantCat = Array.isArray(res) ? null : ((_a = res.dominantCategory) !== null && _a !== void 0 ? _a : null);
                                        preferred = dominantCat ? ((_b = brandPrefs[dominantCat]) !== null && _b !== void 0 ? _b : null) : null;
                                        if (preferred) {
                                            suggestions = __spreadArray(__spreadArray([], suggestions.filter(function (s) { return s.brand === preferred; }), true), suggestions.filter(function (s) { return s.brand !== preferred; }), true);
                                        }
                                        results[item.itemName] = suggestions;
                                        return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 1:
                    _a.sent();
                    setProductSuggestions(results);
                    setProductSuggestionsLoading(false);
                    return [2 /*return*/];
            }
        });
    }); };
    var toggleItemExpanded = function (itemName) {
        setExpandedItems(function (prev) {
            var next = new Set(prev);
            if (next.has(itemName))
                next.delete(itemName);
            else
                next.add(itemName);
            return next;
        });
    };
    var selectCandidate = function (itemName, storeId, candidateIndex) {
        setSelectedCandidates(function (prev) {
            var _a, _b;
            return (__assign(__assign({}, prev), (_a = {}, _a[itemName] = __assign(__assign({}, (prev[itemName] || {})), (_b = {}, _b[storeId] = candidateIndex, _b)), _a)));
        });
    };
    /** Select a candidate and auto-match equivalent products in other stores. */
    var selectAndAutoMatch = function (itemName, storeId, candidateIndex) { return __awaiter(_this, void 0, void 0, function () {
        var storeResult, storeItem, selectedProduct, similar_1, listItem, qty_1, _a;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    selectCandidate(itemName, storeId, candidateIndex);
                    if (!compareResult || !list)
                        return [2 /*return*/];
                    storeResult = compareResult.storeResults.find(function (s) { return s.storeId === storeId; });
                    storeItem = storeResult === null || storeResult === void 0 ? void 0 : storeResult.items.find(function (i) { return i.itemName === itemName; });
                    selectedProduct = storeItem === null || storeItem === void 0 ? void 0 : storeItem.candidates[candidateIndex];
                    if (!selectedProduct)
                        return [2 /*return*/];
                    setAutoMatchLoading(function (prev) { return new Set(__spreadArray(__spreadArray([], prev, true), [itemName], false)); });
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, fetch("/api/products/similar", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ productId: selectedProduct.productId }),
                        }).then(function (r) { return r.json(); })];
                case 2:
                    similar_1 = _c.sent();
                    listItem = list.items.find(function (li) { return li.itemName === itemName; });
                    qty_1 = (_b = listItem === null || listItem === void 0 ? void 0 : listItem.quantity) !== null && _b !== void 0 ? _b : 1;
                    setCompareResult(function (prev) {
                        if (!prev)
                            return prev;
                        var newStoreResults = prev.storeResults.map(function (sr) {
                            if (sr.storeId === storeId)
                                return sr; // leave source store unchanged
                            var matches = similar_1[String(sr.storeId)];
                            if (!matches || matches.length === 0)
                                return sr;
                            var items = sr.items.map(function (item) {
                                if (item.itemName !== itemName)
                                    return item;
                                var newCandidates = matches;
                                var newMatch = matches[0];
                                var lineCost = (0, cost_1.computeLineCost)(newMatch, qty_1);
                                return __assign(__assign({}, item), { match: newMatch, candidates: newCandidates, lineCost: lineCost });
                            });
                            var totalCost = items.reduce(function (s, i) { return s + i.lineCost; }, 0);
                            var matchedCount = items.filter(function (i) { return i.match !== null; }).length;
                            return __assign(__assign({}, sr), { items: items, totalCost: totalCost, matchedCount: matchedCount });
                        });
                        return __assign(__assign({}, prev), { storeResults: newStoreResults });
                    });
                    return [3 /*break*/, 5];
                case 3:
                    _a = _c.sent();
                    return [3 /*break*/, 5];
                case 4:
                    setAutoMatchLoading(function (prev) {
                        var next = new Set(prev);
                        next.delete(itemName);
                        return next;
                    });
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    // Recalculate store totals based on current candidate selections.
    // Only "aligned" matches count toward matchedCount and totalCost —
    // "closest-alt" matches are shown dimmed and excluded from financial totals.
    var recalculatedResults = (0, react_1.useMemo)(function () {
        if (!compareResult || !list)
            return null;
        return compareResult.storeResults.map(function (sr) {
            var totalCost = 0;
            var matchedCount = 0;
            var items = sr.items.map(function (item) {
                var _a, _b, _c;
                var selectedIdx = (_b = (_a = selectedCandidates[item.itemName]) === null || _a === void 0 ? void 0 : _a[sr.storeId]) !== null && _b !== void 0 ? _b : 0;
                var match = item.candidates[selectedIdx] || item.match;
                var listItem = list.items.find(function (li) { return li.itemName === item.itemName; });
                var qty = (_c = listItem === null || listItem === void 0 ? void 0 : listItem.quantity) !== null && _c !== void 0 ? _c : 1;
                var lineCost = 0;
                var isAligned = match && (match.status === "aligned" || match.status == null);
                if (isAligned) {
                    lineCost = (0, cost_1.computeLineCost)(match, qty);
                    matchedCount++;
                }
                totalCost += lineCost;
                return __assign(__assign({}, item), { match: match, lineCost: lineCost });
            });
            return __assign(__assign({}, sr), { items: items, totalCost: totalCost, matchedCount: matchedCount });
        });
    }, [compareResult, selectedCandidates, list]);
    var cheapestRecalc = (0, react_1.useMemo)(function () {
        if (!recalculatedResults || !list)
            return null;
        var full = recalculatedResults.filter(function (s) { return s.matchedCount === list.items.length; });
        if (full.length > 0)
            return full.reduce(function (a, b) { return (a.totalCost < b.totalCost ? a : b); });
        return recalculatedResults.reduce(function (a, b) {
            return b.matchedCount > a.matchedCount || (b.matchedCount === a.matchedCount && b.totalCost < a.totalCost) ? b : a;
        });
    }, [recalculatedResults, list]);
    var splitRecalc = (0, react_1.useMemo)(function () {
        if (!recalculatedResults || !list)
            return null;
        var items = list.items.map(function (item) {
            var bestPrice = Infinity;
            var bestStoreId = 0;
            var bestStoreName = "";
            var bestStoreChain = "";
            var bestMatch = null;
            for (var _i = 0, recalculatedResults_1 = recalculatedResults; _i < recalculatedResults_1.length; _i++) {
                var sr = recalculatedResults_1[_i];
                var si = sr.items.find(function (i) { return i.itemName === item.itemName; });
                if ((si === null || si === void 0 ? void 0 : si.match) && si.lineCost > 0 && si.lineCost < bestPrice) {
                    bestPrice = si.lineCost;
                    bestStoreId = sr.storeId;
                    bestStoreName = sr.storeName;
                    bestStoreChain = sr.storeChain;
                    bestMatch = si.match;
                }
            }
            return {
                itemName: item.itemName,
                bestStoreId: bestStoreId,
                bestStoreName: bestStoreName,
                bestStoreChain: bestStoreChain,
                bestPrice: bestPrice === Infinity ? 0 : bestPrice,
                match: bestMatch,
            };
        });
        return { items: items, totalCost: items.reduce(function (s, i) { return s + i.bestPrice; }, 0) };
    }, [recalculatedResults, list]);
    if (!list) {
        return (<div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>);
    }
    // How many packs of a product cover the requested quantity.
    // e.g. 6 eggs / 10-pack = 1; 200g butter / 125g pack = 2
    var calcPacksNeeded = function (itemQty, itemUnit, packValue, packUnit) {
        var _a, _b;
        if (!packValue || packValue <= 0)
            return 1;
        var iu = (_a = itemUnit === null || itemUnit === void 0 ? void 0 : itemUnit.toLowerCase()) !== null && _a !== void 0 ? _a : null;
        var pu = (_b = packUnit === null || packUnit === void 0 ? void 0 : packUnit.toLowerCase()) !== null && _b !== void 0 ? _b : null;
        var toGrams = function (v, u) { return u === "kg" ? v * 1000 : v; };
        var toMl = function (v, u) { return u === "l" ? v * 1000 : v; };
        if (iu && pu && ["g", "kg"].includes(iu) && ["g", "kg"].includes(pu))
            return Math.max(1, Math.ceil(toGrams(itemQty, iu) / toGrams(packValue, pu)));
        if (iu && pu && ["l", "ml"].includes(iu) && ["l", "ml"].includes(pu))
            return Math.max(1, Math.ceil(toMl(itemQty, iu) / toMl(packValue, pu)));
        if (!iu && pu && ["vnt", "vnt.", "pcs", "pc", "vn"].includes(pu))
            return Math.max(1, Math.ceil(itemQty / packValue));
        return 1;
    };
    var chainColor = {
        IKI: "text-red-600",
        MAXIMA: "text-orange-600",
        BARBORA: "text-orange-600",
        RIMI: "text-blue-600",
        PROMO: "text-purple-600",
    };
    var itemCount = list.items.length;
    var hasProductSuggestions = Object.keys(productSuggestions).length > 0;
    return (<div className="space-y-4">
      {/* Header: back + inline-editable title */}
      <div className="flex items-center gap-3">
        <button_1.Button variant="ghost" size="icon" onClick={function () { return router.back(); }}>
          <lucide_react_1.ArrowLeft className="h-4 w-4"/>
        </button_1.Button>
        {isRenaming ? (<input autoFocus className="text-2xl font-bold bg-transparent border-b-2 border-primary outline-none flex-1 max-w-sm" value={renameValue} onChange={function (e) { return setRenameValue(e.target.value); }} onBlur={commitRename} onKeyDown={function (e) {
                if (e.key === "Enter")
                    commitRename();
                if (e.key === "Escape") {
                    setIsRenaming(false);
                    setRenameValue(list.name);
                }
            }}/>) : (<h1 className="text-2xl font-bold cursor-pointer hover:text-primary transition-colors group flex items-center gap-2" onClick={function () { setIsRenaming(true); setRenameValue(list.name); }} title="Click to rename">
            {list.name}
            <lucide_react_1.Pencil className="h-4 w-4 opacity-0 group-hover:opacity-40 transition-opacity"/>
          </h1>)}
        {(saving || renameSaving) && (<badge_1.Badge variant="secondary" className="text-xs animate-pulse">
            {t("common.save")}…
          </badge_1.Badge>)}
        <button_1.Button variant="ghost" size="icon" className="ml-auto shrink-0" onClick={exportList} title={language === "lt" ? "Eksportuoti sąrašą" : "Export list"}>
          <lucide_react_1.Download className="h-4 w-4"/>
        </button_1.Button>
      </div>

      {/* 3-tab layout */}
      <tabs_1.Tabs value={activeTab} onValueChange={function (v) {
            var next = v;
            setActiveTab(next);
            if (next === "products" && !hasProductSuggestions && itemCount > 0 && !productSuggestionsLoading) {
                fetchProductSuggestions();
            }
            if (next === "compare" && !compareResult && itemCount > 0 && !comparing) {
                comparePrices();
            }
        }}>
        <tabs_1.TabsList className="w-full">
          <tabs_1.TabsTrigger value="items" className="flex-1">
            <lucide_react_1.ClipboardList className="h-3.5 w-3.5 mr-1.5"/>
            {language === "lt" ? "Prekės" : "Items"}
            {itemCount > 0 && (<span className="ml-1.5 text-xs opacity-70">({itemCount})</span>)}
          </tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="products" className="flex-1">
            <lucide_react_1.Package className="h-3.5 w-3.5 mr-1.5"/>
            {language === "lt" ? "Produktai" : "Products"}
          </tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="compare" className="flex-1">
            <lucide_react_1.Scale className="h-3.5 w-3.5 mr-1.5"/>
            {language === "lt" ? "Palyginti" : "Compare"}
          </tabs_1.TabsTrigger>
        </tabs_1.TabsList>

        {/* ─── Tab 1: Items ─── */}
        <tabs_1.TabsContent value="items" className="space-y-4 mt-4">
          {/* Mass import */}
          <card_1.Card>
            <card_1.CardHeader className="pb-3">
              <card_1.CardTitle className="text-base flex items-center gap-2">
                <lucide_react_1.ClipboardList className="h-4 w-4"/>
                {language === "lt" ? "Įklijuoti prekes" : "Paste items"}
              </card_1.CardTitle>
            </card_1.CardHeader>
            <card_1.CardContent className="space-y-3">
              <textarea className="w-full min-h-[90px] p-2.5 rounded-md border bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring" placeholder={language === "lt"
            ? "pienas, duona\n2kg vištiena\n6 kiaušiniai"
            : "milk, bread\n2kg chicken\n6 eggs"} value={importText} onChange={function (e) { setImportText(e.target.value); setImportParsed(null); }}/>

              {/* Parsed preview */}
              {importParsed !== null && (<div className="rounded-md bg-muted/50 p-3 text-sm">
                  {importParsed.length === 0 ? (<p className="text-muted-foreground italic text-xs">Nothing to parse</p>) : (<>
                      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                        {language === "lt" ? "Bus pridėta:" : "You're adding:"}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {importParsed.map(function (_a, i) {
                    var parsed = _a.parsed;
                    return (<badge_1.Badge key={i} variant="secondary" className="text-xs">
                            {parsed.name}
                            {(parsed.quantity !== 1 || parsed.unit) && (<span className="ml-1 opacity-60">
                                ×{parsed.quantity}{parsed.unit ? " ".concat(parsed.unit) : ""}
                              </span>)}
                          </badge_1.Badge>);
                })}
                      </div>
                    </>)}
                </div>)}

              <div className="flex gap-2">
                <button_1.Button variant="outline" size="sm" onClick={handlePreviewImport} disabled={!importText.trim()}>
                  {language === "lt" ? "Peržiūrėti" : "Preview"}
                </button_1.Button>
                {importParsed !== null && importParsed.length > 0 && (<button_1.Button size="sm" onClick={handleAddAll} disabled={importAdding} className="gap-1.5">
                    {importAdding ? (<lucide_react_1.Loader2 className="h-3.5 w-3.5 animate-spin"/>) : (<lucide_react_1.Plus className="h-3.5 w-3.5"/>)}
                    {language === "lt" ? "Prid\u0117ti visk\u0105 (".concat(importParsed.length, ")") : "Add All (".concat(importParsed.length, ")")}
                  </button_1.Button>)}
              </div>
            </card_1.CardContent>
          </card_1.Card>

          {/* Single-item add */}
          <card_1.Card>
            <card_1.CardHeader className="pb-3">
              <card_1.CardTitle className="text-lg">{t("groceryLists.addItem")}</card_1.CardTitle>
            </card_1.CardHeader>
            <card_1.CardContent>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input_1.Input ref={inputRef} placeholder={t("groceryLists.itemName")} value={newItem} onChange={function (e) { return setNewItem(e.target.value); }} onKeyDown={handleInputKeyDown} onFocus={function () { return suggestions.length > 0 && setShowSuggestions(true); }} autoComplete="off"/>
                  {showSuggestions && suggestions.length > 0 && (<div ref={suggestRef} className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-80 overflow-y-auto">
                      {suggestions.map(function (s, i) { return (<div key={s.id} className={"flex items-center gap-1 border-b last:border-0 ".concat(i === selectedSuggestion ? "bg-accent" : "")}>
                          <button onClick={function () { return pickSuggestion(s); }} className="flex-1 text-left px-3 py-2 text-sm hover:bg-accent/50 flex items-center gap-2 min-w-0">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{s.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {s.store}
                                {s.brand && <span className="ml-1 text-primary/70">· {s.brand}</span>}
                                {s.weightValue && s.weightUnit && (<span className="ml-1 text-muted-foreground/60">· {s.weightValue}{s.weightUnit}</span>)}
                              </p>
                            </div>
                            {s.price != null && (<div className="text-right shrink-0">
                                <span className="text-xs font-semibold text-primary">{s.price.toFixed(2)}€</span>
                                {s.unitPrice != null && s.unitLabel && (<p className="text-[10px] text-muted-foreground">{s.unitPrice.toFixed(2)}€/{s.unitLabel}</p>)}
                              </div>)}
                          </button>
                          <button onClick={function (e) { e.stopPropagation(); setPreviewProductId(s.id); setShowSuggestions(false); }} className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors shrink-0" title="Preview product">
                            <lucide_react_1.Info className="h-3.5 w-3.5"/>
                          </button>
                          <button onClick={function (e) { e.stopPropagation(); addSuggestionDirectly(s); }} className="p-2 text-muted-foreground hover:text-primary hover:bg-accent/50 transition-colors shrink-0 mr-1" title="Add directly to list">
                            <lucide_react_1.Plus className="h-3.5 w-3.5"/>
                          </button>
                        </div>); })}
                      {dominantCategory && (<div className="border-t px-3 py-2">
                          <button onClick={function (e) {
                    e.preventDefault();
                    setShowSuggestions(false);
                    setShowBrandPicker(true);
                }} className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline">
                            <lucide_react_1.Tag className="h-3 w-3"/>
                            {language === "lt" ? "Pasirinkti prekės ženklą..." : "Pick a brand..."}
                            {(0, brandPreferences_1.getPreferredBrand)(dominantCategory) && (<span className="text-muted-foreground font-normal">
                                ({(0, brandPreferences_1.getPreferredBrand)(dominantCategory)})
                              </span>)}
                          </button>
                        </div>)}
                    </div>)}
                </div>
                <input_1.Input type="number" placeholder={t("groceryLists.quantity")} value={newQty} onChange={function (e) { return setNewQty(e.target.value); }} className="w-20" min="0.1" step="0.1"/>
                <button_1.Button onClick={addItem} size="icon" className="shrink-0">
                  <lucide_react_1.Plus className="h-4 w-4"/>
                </button_1.Button>
              </div>

              {/* Quick quantity presets */}
              {pickedSuggestion && (<div className="flex items-center gap-1 mt-2 flex-wrap">
                  <span className="text-xs text-muted-foreground mr-1">
                    {pickedSuggestion.weightUnit && (<span className="font-medium">
                        {pickedSuggestion.weightValue}{pickedSuggestion.weightUnit}
                        {" · "}
                      </span>)}
                    Qty:
                  </span>
                  {getQuantityPresets(pickedSuggestion).map(function (preset) { return (<button_1.Button key={preset.label} variant={newQty === String(preset.value) ? "default" : "outline"} size="sm" className="h-6 text-xs px-2" onClick={function () { return setNewQty(String(preset.value)); }}>
                      {preset.label}
                    </button_1.Button>); })}
                </div>)}

              {liveHint && (<div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                  <lucide_react_1.Info className="h-3 w-3 shrink-0"/>
                  <span>{liveHint}</span>
                </div>)}
              {parsedPreview && (<div className="flex items-center gap-2 mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                  <lucide_react_1.Check className="h-3 w-3"/>
                  <span>Added: <strong>{parsedPreview}</strong></span>
                </div>)}
            </card_1.CardContent>
          </card_1.Card>

          {/* Items list */}
          <card_1.Card>
            {list.items.length > 0 && (<div className="px-4 pt-3 pb-1 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {list.items.filter(function (i) { return i.checked; }).length}/{list.items.length} checked
                </span>
                {list.items.some(function (i) { return i.checked; }) && (<button className="text-xs text-muted-foreground hover:text-foreground underline" onClick={function () { return __awaiter(_this, void 0, void 0, function () {
                    var items;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                items = list.items.filter(function (i) { return !i.checked; });
                                setList(__assign(__assign({}, list), { items: items }));
                                return [4 /*yield*/, saveItems(items)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); }}>
                    Clear checked
                  </button>)}
              </div>)}
            <card_1.CardContent className="p-0">
              {list.items.length === 0 ? (<p className="text-center text-muted-foreground py-8 text-sm">
                  {language === "lt" ? "Nėra prekių. Pridėkite aukščiau." : "No items yet. Add some above."}
                </p>) : (<ul className="divide-y">
                  {list.items.map(function (item, index) { return (<li key={index} className="flex items-center gap-3 px-4 py-3">
                      <button onClick={function () { return toggleCheck(index); }} className={"shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ".concat(item.checked
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-input")}>
                        {item.checked && <lucide_react_1.Check className="h-3 w-3"/>}
                      </button>
                      <div className={"flex-1 min-w-0 ".concat(item.checked ? "line-through text-muted-foreground" : "")}>
                        <span className="text-sm">{item.itemName}</span>
                        {(item.quantity !== 1 || item.unit) && (<span className="text-xs text-muted-foreground ml-1.5">
                            ×{item.quantity}{item.unit ? " " + item.unit : ""}
                          </span>)}
                      </div>
                      <span className="text-sm text-muted-foreground shrink-0">
                        {editingIndex === index ? (<input type="number" className="w-14 h-6 text-xs text-center border rounded bg-background" value={editQty} onChange={function (e) { return setEditQty(e.target.value); }} onBlur={function () {
                        var q = parseFloat(editQty);
                        if (q > 0)
                            updateItemQty(index, q);
                        else
                            setEditingIndex(null);
                    }} onKeyDown={function (e) {
                        if (e.key === "Enter") {
                            var q = parseFloat(editQty);
                            if (q > 0)
                                updateItemQty(index, q);
                            else
                                setEditingIndex(null);
                        }
                        else if (e.key === "Escape") {
                            setEditingIndex(null);
                        }
                    }} autoFocus min="0.1" step="0.1"/>) : (<button onClick={function () {
                        setEditingIndex(index);
                        setEditQty(String(item.quantity));
                    }} className="hover:bg-accent px-1 rounded cursor-pointer text-xs" title="Click to edit quantity">
                            edit qty
                          </button>)}
                      </span>
                      <button_1.Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={function () { return removeItem(index); }}>
                        <lucide_react_1.Trash2 className="h-4 w-4"/>
                      </button_1.Button>
                    </li>); })}
                </ul>)}

              {/* Import from another list */}
              {allLists.length > 0 && (<div className="p-4 border-t">
                  <select_1.Select onValueChange={importFromList}>
                    <select_1.SelectTrigger className="w-full">
                      <select_1.SelectValue placeholder={t("groceryLists.importFromOld")}/>
                    </select_1.SelectTrigger>
                    <select_1.SelectContent>
                      {allLists.map(function (l) { return (<select_1.SelectItem key={l.id} value={String(l.id)}>
                          <lucide_react_1.Download className="h-3 w-3 inline mr-2"/>
                          {l.name}
                        </select_1.SelectItem>); })}
                    </select_1.SelectContent>
                  </select_1.Select>
                </div>)}
            </card_1.CardContent>
          </card_1.Card>

        </tabs_1.TabsContent>

        {/* ─── Tab 2: Products ─── */}
        <tabs_1.TabsContent value="products" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {language === "lt"
            ? "Pasirinkite konkrečius produktus kiekvienai prekei prieš lyginant kainas."
            : "Pick specific products for each item before comparing prices."}
            </p>
            <button_1.Button variant="outline" size="sm" onClick={fetchProductSuggestions} disabled={productSuggestionsLoading} className="gap-1.5 shrink-0 ml-3">
              {productSuggestionsLoading ? (<lucide_react_1.Loader2 className="h-3.5 w-3.5 animate-spin"/>) : (<lucide_react_1.Package className="h-3.5 w-3.5"/>)}
              {hasProductSuggestions
            ? (language === "lt" ? "Atnaujinti" : "Refresh")
            : (language === "lt" ? "Ieškoti produktų" : "Find Products")}
            </button_1.Button>
          </div>

          {/* Dietary filters */}
          {hasProductSuggestions && (<div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground shrink-0">
                {language === "lt" ? "Dieta:" : "Diet:"}
              </span>
              {([
                { id: null, label: language === "lt" ? "Visi" : "All" },
                { id: "vegan", label: language === "lt" ? "Veganiška" : "Vegan" },
                { id: "vegetarian", label: language === "lt" ? "Vegetariška" : "Vegetarian" },
                { id: "gluten-free", label: language === "lt" ? "Be gliuteno" : "Gluten-free" },
                { id: "lactose-free", label: language === "lt" ? "Be laktozės" : "Lactose-free" },
            ]).map(function (f) { return (<button key={String(f.id)} onClick={function () { return setDietaryFilter(f.id); }} className={"text-xs px-2 py-0.5 rounded border transition-colors ".concat(dietaryFilter === f.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/50")}>
                  {f.label}
                </button>); })}
            </div>)}

          {!hasProductSuggestions && !productSuggestionsLoading && (<card_1.Card>
              <card_1.CardContent className="py-10 text-center">
                <lucide_react_1.Package className="h-10 w-10 mx-auto text-muted-foreground mb-3"/>
                <p className="text-muted-foreground text-sm">
                  {itemCount === 0
                ? (language === "lt"
                    ? "Dar nėra prekių. Pridėkite prekių skirtuke 'Prekės'."
                    : "No items yet. Add items on the Items tab to see product suggestions.")
                : (language === "lt"
                    ? "Spustelėkite 'Ieškoti produktų', kad rastumėte atitikmenų kiekvienai prekei."
                    : "Click 'Find Products' to search for matches for each item.")}
                </p>
              </card_1.CardContent>
            </card_1.Card>)}

          {productSuggestionsLoading && (<card_1.Card>
              <card_1.CardContent className="py-10 flex items-center justify-center gap-3">
                <lucide_react_1.Loader2 className="h-5 w-5 animate-spin text-muted-foreground"/>
                <p className="text-muted-foreground text-sm">
                  {language === "lt" ? "Ieškoma..." : "Searching..."}
                </p>
              </card_1.CardContent>
            </card_1.Card>)}

          {hasProductSuggestions && list.items.map(function (item) {
            var _a, _b, _c, _d;
            var allCandidates = productSuggestions[item.itemName] || [];
            var activeCategory = (_a = categoryFilters[item.itemName]) !== null && _a !== void 0 ? _a : null;
            // Distinct categories for disambiguation pills
            var distinctCategories = __spreadArray([], new Set(allCandidates.map(function (c) { return c.canonicalCategory; }).filter(Boolean)), true);
            var candidates = allCandidates
                .filter(function (c) { return !activeCategory || c.canonicalCategory === activeCategory; })
                .filter(function (c) { return !dietaryFilter || (0, dietaryTags_1.matchesDietaryFilter)(dietaryFilter, {
                name: c.name, nameEn: c.nameEn,
                canonicalCategory: c.canonicalCategory, subcategory: c.subcategory,
            }); });
            // Preferred brand for this item's category
            var itemPreferredBrand = ((_b = allCandidates[0]) === null || _b === void 0 ? void 0 : _b.canonicalCategory)
                ? (0, brandPreferences_1.getPreferredBrand)(allCandidates[0].canonicalCategory)
                : null;
            var pinnedId = (_c = item.pinnedProductId) !== null && _c !== void 0 ? _c : null;
            var itemSimilar = (_d = similarByItem[item.itemName]) !== null && _d !== void 0 ? _d : {};
            var itemSimilarLoading = similarLoading.has(item.itemName);
            return (<card_1.Card key={item.itemName}>
                <card_1.CardHeader className="pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{item.itemName}</span>
                    {(item.quantity !== 1 || item.unit) && (<badge_1.Badge variant="secondary" className="text-xs">
                        ×{item.quantity}{item.unit ? " ".concat(item.unit) : ""}
                      </badge_1.Badge>)}
                    {pinnedId && (<badge_1.Badge className="text-xs gap-1 bg-emerald-600 text-white">
                        <lucide_react_1.Check className="h-2.5 w-2.5"/>
                        {language === "lt" ? "Pasirinkta" : "Selected"}
                      </badge_1.Badge>)}
                    {itemSimilarLoading && (<lucide_react_1.Loader2 className="h-3 w-3 animate-spin text-muted-foreground"/>)}
                    {allCandidates.length === 0 && (<badge_1.Badge variant="outline" className="text-xs text-red-500">
                        {language === "lt" ? "nerasta" : "not found"}
                      </badge_1.Badge>)}
                    {/* Category disambiguation pills */}
                    {distinctCategories.length > 1 && (<div className="flex gap-1 flex-wrap ml-1">
                        <button onClick={function () { return setCategoryFilters(function (p) {
                    var _a;
                    return (__assign(__assign({}, p), (_a = {}, _a[item.itemName] = null, _a)));
                }); }} className={"text-[10px] px-1.5 py-0.5 rounded border transition-colors ".concat(activeCategory === null
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50")}>
                          {language === "lt" ? "Visi" : "All"}
                        </button>
                        {distinctCategories.map(function (cat) { return (<button key={cat} onClick={function () { return setCategoryFilters(function (p) {
                        var _a;
                        return (__assign(__assign({}, p), (_a = {}, _a[item.itemName] = cat, _a)));
                    }); }} className={"text-[10px] px-1.5 py-0.5 rounded border transition-colors ".concat(activeCategory === cat
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:border-primary/50")}>
                            {cat}
                          </button>); })}
                      </div>)}
                  </div>
                </card_1.CardHeader>
                {candidates.length > 0 && (<card_1.CardContent className="pt-0 space-y-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {candidates.map(function (c) {
                        var isPinned = pinnedId === c.id;
                        return (<div key={c.id} className={"border rounded-lg p-2.5 cursor-pointer hover:border-primary hover:bg-accent/30 transition-colors relative ".concat(isPinned
                                ? "border-emerald-500 bg-emerald-50/30 dark:bg-emerald-900/10"
                                : itemPreferredBrand && c.brand === itemPreferredBrand
                                    ? "border-amber-400/60 bg-amber-50/30 dark:bg-amber-900/10"
                                    : "")} onClick={function () { setPreviewProductId(c.id); setPreviewSourceItemName(item.itemName); }}>
                            {isPinned && (<span className="absolute top-1.5 left-1.5 text-emerald-600" title="Your selection">
                                <lucide_react_1.Check className="h-3 w-3"/>
                              </span>)}
                            {!isPinned && itemPreferredBrand && c.brand === itemPreferredBrand && (<span className="absolute top-1.5 left-1.5 text-[10px]" title="Preferred brand">⭐</span>)}
                            {c.price != null && (<div className="flex items-baseline gap-1 flex-wrap">
                                <span className="text-xs font-bold text-primary">{c.price.toFixed(2)}€</span>
                                {c.unitPrice != null && c.unitLabel && (<span className="text-[10px] text-muted-foreground">{c.unitPrice.toFixed(2)}€/{c.unitLabel}</span>)}
                              </div>)}
                            <p className="text-xs font-medium leading-snug mt-1 line-clamp-2">{c.name}</p>
                            {c.brand && (<p className="text-[10px] text-muted-foreground mt-0.5">{c.brand}</p>)}
                            {c.weightValue && c.weightUnit && (<p className="text-[10px] text-muted-foreground">{c.weightValue}{c.weightUnit}</p>)}
                            <badge_1.Badge variant="outline" className={"text-[10px] mt-1.5 truncate max-w-full ".concat(chainColor[c.chain] || "")}>
                              {c.store}
                            </badge_1.Badge>
                            <button className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-foreground" onClick={function (e) { e.stopPropagation(); setPreviewProductId(c.id); setPreviewSourceItemName(item.itemName); }} title="Preview">
                              <lucide_react_1.Info className="h-3 w-3"/>
                            </button>
                          </div>);
                    })}
                    </div>

                    {/* Cross-store picks strip — shown when user has selected a product */}
                    {pinnedId && Object.keys(itemSimilar).length > 0 && (<div className="border rounded-md p-2.5 bg-muted/30 space-y-1.5">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                          {language === "lt" ? "Automatiškai pasirinkta kitose parduotuvėse:" : "Auto-picked in other stores:"}
                        </p>
                        <div className="flex flex-col gap-1">
                          {Object.entries(itemSimilar).map(function (_a) {
                            var storeIdStr = _a[0], matches = _a[1];
                            var best = matches[0];
                            if (!best)
                                return null;
                            return (<div key={storeIdStr} className="flex items-center gap-2 text-xs">
                                <button className="flex-1 flex items-center gap-2 hover:bg-accent/50 rounded px-1 py-0.5 text-left" onClick={function () { return setPreviewProductId(best.productId); }} title="Preview">
                                  <span className="font-medium truncate">{best.productName}</span>
                                  {best.brand && (<span className="text-muted-foreground shrink-0">· {best.brand}</span>)}
                                  {best.weightValue && best.weightUnit && (<span className="text-muted-foreground shrink-0">{best.weightValue}{best.weightUnit}</span>)}
                                  {best.price != null && (<span className="font-semibold text-primary shrink-0 ml-auto">{best.price.toFixed(2)}€</span>)}
                                </button>
                              </div>);
                        })}
                        </div>
                      </div>)}
                  </card_1.CardContent>)}
              </card_1.Card>);
        })}

        </tabs_1.TabsContent>

        {/* ─── Tab 3: Compare ─── */}
        <tabs_1.TabsContent value="compare" className="space-y-4 mt-4">
          {!compareResult ? (<card_1.Card>
              <card_1.CardContent className="py-10 text-center">
                {comparing ? (<>
                    <lucide_react_1.Loader2 className="h-8 w-8 mx-auto text-muted-foreground mb-3 animate-spin"/>
                    <p className="text-muted-foreground text-sm">
                      {language === "lt" ? "Lyginame kainas..." : "Comparing prices..."}
                    </p>
                  </>) : (<>
                    <lucide_react_1.Scale className="h-10 w-10 mx-auto text-muted-foreground mb-3"/>
                    <p className="text-muted-foreground text-sm mb-4">
                      {itemCount === 0
                    ? (language === "lt"
                        ? "Dar nėra prekių. Pridėkite prekių skirtuke 'Prekės'."
                        : "No items yet. Add items on the Items tab to compare prices.")
                    : (language === "lt"
                        ? "Paspauskite mygtuką, kad palygintumėte kainas."
                        : "Tap the button to compare prices.")}
                    </p>
                    {itemCount > 0 && (<button_1.Button onClick={comparePrices} disabled={comparing} className="gap-2">
                        <lucide_react_1.Scale className="h-4 w-4"/>
                        {language === "lt" ? "Palyginti kainas" : "Compare Prices"}
                      </button_1.Button>)}
                  </>)}
              </card_1.CardContent>
            </card_1.Card>) : (<>
              {/* Re-run button */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {language === "lt" ? "Palyginimo rezultatai" : "Comparison results"}
                </p>
                <button_1.Button variant="outline" size="sm" onClick={comparePrices} disabled={comparing} className="gap-1.5">
                  {comparing ? (<lucide_react_1.Loader2 className="h-3.5 w-3.5 animate-spin"/>) : (<lucide_react_1.Scale className="h-3.5 w-3.5"/>)}
                  {language === "lt" ? "Atnaujinti" : "Re-run"}
                </button_1.Button>
              </div>

              {recalculatedResults && (<div className="space-y-6">
                  {/* Section 1: Item Matching */}
                  <card_1.Card>
                    <card_1.CardHeader className="pb-3">
                      <card_1.CardTitle className="text-lg flex items-center gap-2">
                        <lucide_react_1.Package className="h-5 w-5"/>
                        {t("compare.itemMatching") || "Matched Products"}
                      </card_1.CardTitle>
                    </card_1.CardHeader>
                    <card_1.CardContent className="space-y-2">
                      {list.items.map(function (item) {
                    var _a, _b, _c;
                    var isExpanded = expandedItems.has(item.itemName);
                    var itemAnchor = (_a = compareResult === null || compareResult === void 0 ? void 0 : compareResult.itemAnchors) === null || _a === void 0 ? void 0 : _a.find(function (a) { return a.itemName === item.itemName; });
                    // Aligned stores: have a proper category-matching product
                    var alignedStoreCandidates = recalculatedResults.map(function (sr) {
                        var storeItem = sr.items.find(function (i) { return i.itemName === item.itemName; });
                        return { store: sr, storeItem: storeItem };
                    }).filter(function (x) {
                        var _a;
                        var m = (_a = x.storeItem) === null || _a === void 0 ? void 0 : _a.match;
                        return m && (m.status === "aligned" || m.status == null);
                    });
                    // Closest-alt stores: have something but it's a different category
                    var closestAltStoreCandidates = recalculatedResults.map(function (sr) {
                        var storeItem = sr.items.find(function (i) { return i.itemName === item.itemName; });
                        return { store: sr, storeItem: storeItem };
                    }).filter(function (x) { var _a, _b; return ((_b = (_a = x.storeItem) === null || _a === void 0 ? void 0 : _a.match) === null || _b === void 0 ? void 0 : _b.status) === "closest-alt"; });
                    // Best aligned match (cheapest among aligned stores)
                    var bestOverall = alignedStoreCandidates.reduce(function (best, _a) {
                        var store = _a.store, storeItem = _a.storeItem;
                        if (!(storeItem === null || storeItem === void 0 ? void 0 : storeItem.match))
                            return best;
                        var lc = (0, cost_1.computeLineCost)(storeItem.match, item.quantity);
                        if (!best || lc < best.lineCost)
                            return { store: store, match: storeItem.match, lineCost: lc };
                        return best;
                    }, null);
                    var alignedCount = alignedStoreCandidates.length;
                    var totalStores = recalculatedResults.length;
                    var isAutoMatching = autoMatchLoading.has(item.itemName);
                    return (<div key={item.itemName} className="border rounded-lg overflow-hidden">
                            <button onClick={function () { return toggleItemExpanded(item.itemName); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{item.itemName}</span>
                                  {item.quantity !== 1 && (<badge_1.Badge variant="secondary" className="text-xs">
                                      ×{item.quantity}{item.unit ? " ".concat(item.unit) : ""}
                                    </badge_1.Badge>)}
                                </div>
                                {(bestOverall === null || bestOverall === void 0 ? void 0 : bestOverall.match) ? (<div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-emerald-600 font-semibold shrink-0" title="Same item found">✓</span>
                                    <span className="text-xs text-muted-foreground truncate">
                                      {bestOverall.match.productName}
                                      {bestOverall.match.brand && (<span className="text-muted-foreground/70"> · {bestOverall.match.brand}</span>)}
                                      {bestOverall.match.weightValue && bestOverall.match.weightUnit && (<span className="text-muted-foreground/70"> · {bestOverall.match.weightValue}{bestOverall.match.weightUnit}</span>)}
                                    </span>
                                  </div>) : closestAltStoreCandidates.length > 0 ? (<div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-amber-500 font-semibold shrink-0" title="No exact match — alternatives available">~</span>
                                    <span className="text-xs text-amber-600/70 italic truncate">
                                      {language === "lt" ? "Tiksli prekė nerasta" : "No exact match"} · {closestAltStoreCandidates.length} {language === "lt" ? "alternatyv" : "alt"}
                                    </span>
                                  </div>) : (<span className="text-xs text-red-500 italic">{t("compare.notFound")}</span>)}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {bestOverall && (<div className="text-right">
                                    <span className="text-sm font-semibold">{bestOverall.lineCost.toFixed(2)}€</span>
                                    <p className={"text-[10px] ".concat(chainColor[bestOverall.store.storeChain] || "text-muted-foreground")}>
                                      {bestOverall.store.storeName}
                                      {((_b = bestOverall.match) === null || _b === void 0 ? void 0 : _b.matchType) === "pack" && " · pack"}
                                      {((_c = bestOverall.match) === null || _c === void 0 ? void 0 : _c.matchType) === "unit" && item.quantity > 1 && " \u00B7 ".concat(item.quantity, "\u00D7")}
                                    </p>
                                  </div>)}
                                {isAutoMatching && (<lucide_react_1.Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0"/>)}
                                <badge_1.Badge variant="outline" className={"text-[10px] ".concat(alignedCount === 0 ? "border-red-300 text-red-500" : alignedCount < totalStores ? "border-amber-300 text-amber-600" : "")} title={alignedCount < totalStores && closestAltStoreCandidates.length > 0 ? "".concat(closestAltStoreCandidates.length, " store(s) have alternatives (different category)") : undefined}>
                                  {alignedCount}/{totalStores}
                                </badge_1.Badge>
                                {isExpanded ? (<lucide_react_1.ChevronUp className="h-4 w-4 text-muted-foreground"/>) : (<lucide_react_1.ChevronDown className="h-4 w-4 text-muted-foreground"/>)}
                              </div>
                            </button>

                            {isExpanded && (<div className="border-t bg-muted/30 px-4 py-3 space-y-3">
                                {itemAnchor && itemAnchor.category && (<div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pb-1 border-b border-dashed">
                                    <span className="opacity-60">{language === "lt" ? "Ieškoma kategorija:" : "Searching for:"}</span>
                                    <badge_1.Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                                      {itemAnchor.category.replace(/\//g, " › ")}
                                    </badge_1.Badge>
                                    {itemAnchor.anchorProductName && (<span className="opacity-60 truncate">· {language === "lt" ? "geriausias atitikmuo:" : "best match:"} {itemAnchor.anchorProductName}</span>)}
                                  </div>)}
                                {recalculatedResults.map(function (sr) {
                                var _a, _b, _c;
                                var storeItem = sr.items.find(function (i) { return i.itemName === item.itemName; });
                                var hasClosestAlt = ((_a = storeItem === null || storeItem === void 0 ? void 0 : storeItem.match) === null || _a === void 0 ? void 0 : _a.status) === "closest-alt";
                                if (!storeItem || storeItem.candidates.length === 0) {
                                    return (<div key={sr.storeId} className="flex items-center justify-between text-sm opacity-40">
                                        <span className={"font-medium ".concat(chainColor[sr.storeChain] || "")}>{sr.storeName}</span>
                                        <span className="text-xs italic text-red-400">{language === "lt" ? "nerasta" : "not available"}</span>
                                      </div>);
                                }
                                // Show "not available" for stores where only closest-alt exists and no aligned match
                                if (hasClosestAlt && alignedStoreCandidates.every(function (x) { return x.store.storeId !== sr.storeId; })) {
                                    // This store only has closest-alt — show it dimmed at the bottom
                                }
                                var selectedIdx = (_c = (_b = selectedCandidates[item.itemName]) === null || _b === void 0 ? void 0 : _b[sr.storeId]) !== null && _c !== void 0 ? _c : 0;
                                return (<div key={sr.storeId} className="space-y-1">
                                      <p className={"text-xs font-semibold ".concat(chainColor[sr.storeChain] || "")}>
                                        {sr.storeName}
                                      </p>
                                      {storeItem.candidates.map(function (c, ci) {
                                        var _a, _b;
                                        var effectivePrice = Math.min(c.price, (_a = c.salePrice) !== null && _a !== void 0 ? _a : Infinity, (_b = c.loyaltyPrice) !== null && _b !== void 0 ? _b : Infinity);
                                        var lineCost = (0, cost_1.computeLineCost)(c, item.quantity);
                                        var isSelected = ci === selectedIdx;
                                        var isPack = c.matchType === "pack";
                                        var isClosestAlt = c.status === "closest-alt";
                                        // Show separator before the first closest-alt candidate
                                        var prevIsAligned = ci > 0 && storeItem.candidates[ci - 1].status !== "closest-alt";
                                        return (<div key={c.productId}>
                                            {isClosestAlt && prevIsAligned && (<div className="flex items-center gap-2 my-1 opacity-50">
                                                <div className="flex-1 h-px bg-border"/>
                                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                  {language === "lt" ? "artimiausi pakaitalai" : "closest alternatives"}
                                                </span>
                                                <div className="flex-1 h-px bg-border"/>
                                              </div>)}
                                          <button onClick={function () { return selectAndAutoMatch(item.itemName, sr.storeId, ci); }} onDoubleClick={function () { return setPreviewProductId(c.productId); }} className={"w-full flex items-center gap-2 px-3 py-2 rounded text-left text-sm transition-colors ".concat(isClosestAlt ? "opacity-50 " : "").concat(isSelected
                                                ? "bg-primary/10 border border-primary/30"
                                                : "hover:bg-accent/50 border border-transparent")}>
                                            {c.imageUrl && (<img src={c.imageUrl} alt="" className="w-8 h-8 object-contain rounded shrink-0"/>)}
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm truncate">{c.productName}</p>
                                              <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                                                {c.brand && <span>{c.brand}</span>}
                                                {c.brand && c.weightValue && <span>·</span>}
                                                {c.weightValue && c.weightUnit && (<span>{c.weightValue}{c.weightUnit}</span>)}
                                                {isPack && (<badge_1.Badge variant="secondary" className="text-[10px] py-0 px-1 ml-1">
                                                    {item.quantity}-pack
                                                  </badge_1.Badge>)}
                                                {isClosestAlt && (<badge_1.Badge variant="outline" className="text-[10px] py-0 px-1 ml-1 border-amber-300 text-amber-600">
                                                    {language === "lt" ? "kita kategorija" : "diff. category"}
                                                  </badge_1.Badge>)}
                                              </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                              <p className="font-semibold text-sm">{lineCost.toFixed(2)}€</p>
                                              {!isPack && item.quantity > 1 && (<p className="text-[10px] text-muted-foreground">
                                                  {item.quantity} × {effectivePrice.toFixed(2)}€
                                                </p>)}
                                              {isPack && (<p className="text-[10px] text-muted-foreground">
                                                  {(effectivePrice / item.quantity).toFixed(2)}€/ea
                                                </p>)}
                                              {c.salePrice && c.salePrice < c.price && !isPack && item.quantity <= 1 && (<p className="text-[10px] line-through text-muted-foreground">
                                                  {c.price.toFixed(2)}€
                                                </p>)}
                                              {c.unitPrice != null && c.unitLabel && (<p className="text-[10px] text-sky-600 dark:text-sky-400">
                                                  {c.unitPrice.toFixed(2)}€/{c.unitLabel}
                                                </p>)}
                                            </div>
                                            <div className="flex flex-col items-center gap-1 shrink-0">
                                              {isSelected && <lucide_react_1.Check className="h-4 w-4 text-primary"/>}
                                              <button onClick={function (e) { e.stopPropagation(); setPreviewProductId(c.productId); }} className="text-muted-foreground hover:text-foreground" title="Preview product">
                                                <lucide_react_1.Info className="h-3.5 w-3.5"/>
                                              </button>
                                            </div>
                                          </button>
                                          </div>);
                                    })}
                                    </div>);
                            })}
                              </div>)}
                          </div>);
                })}
                    </card_1.CardContent>
                  </card_1.Card>

                  {/* Section 2: Store Recommendations */}
                  <card_1.Card>
                    <card_1.CardHeader className="pb-3">
                      <card_1.CardTitle className="text-lg flex items-center gap-2">
                        <lucide_react_1.ShoppingCart className="h-5 w-5"/>
                        {t("compare.storeRecommendations") || "Store Recommendations"}
                      </card_1.CardTitle>
                      {/* Travel mode selector — affects distance penalty in smart score */}
                      {compareResult.smartRecommendation && (<div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            {language === "lt" ? "Transportas:" : "Travel mode:"}
                          </span>
                          {[
                        { label: language === "lt" ? "Pėsčias" : "Walking", value: 0.05 },
                        { label: language === "lt" ? "Dviratis" : "Cycling", value: 0.1 },
                        { label: language === "lt" ? "Automobilis" : "Car", value: 0.3 },
                        { label: language === "lt" ? "Ignoruoti" : "Ignore dist.", value: 0 },
                    ].map(function (m) { return (<button key={m.value} onClick={function () { return setTravelCostPerKm(m.value); }} className={"text-xs px-2 py-0.5 rounded border transition-colors ".concat(travelCostPerKm === m.value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:border-primary/50")}>
                              {m.label}
                            </button>); })}
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ({travelCostPerKm === 0 ? "—" : "".concat(travelCostPerKm.toFixed(2), "\u20AC/km")})
                          </span>
                          {travelCostPerKm !== ((_a = compareResult.smartRecommendation[0]) === null || _a === void 0 ? void 0 : _a.travelPenalty) / ((_c = (_b = compareResult.smartRecommendation[0]) === null || _b === void 0 ? void 0 : _b.distanceKm) !== null && _c !== void 0 ? _c : 1) / 2 && (<button onClick={comparePrices} className="text-[10px] text-primary underline ml-1">
                              {language === "lt" ? "Perskaičiuoti →" : "Recalculate →"}
                            </button>)}
                        </div>)}
                    </card_1.CardHeader>
                    <card_1.CardContent>
                      <tabs_1.Tabs defaultValue={compareResult.smartRecommendation ? "smart" : "single"}>
                        <tabs_1.TabsList className="w-full">
                          {compareResult.smartRecommendation && (<tabs_1.TabsTrigger value="smart" className="flex-1">
                              <lucide_react_1.Navigation className="h-3 w-3 mr-1"/>
                              {t("compare.smartPick") || "Smart"}
                            </tabs_1.TabsTrigger>)}
                          <tabs_1.TabsTrigger value="single" className="flex-1">
                            {t("compare.singleStore")}
                          </tabs_1.TabsTrigger>
                          <tabs_1.TabsTrigger value="split" className="flex-1">
                            {t("compare.splitShopping")}
                          </tabs_1.TabsTrigger>
                        </tabs_1.TabsList>

                        {compareResult.smartRecommendation && (<tabs_1.TabsContent value="smart" className="space-y-3 mt-4">
                            <p className="text-xs text-muted-foreground">
                              {t("compare.smartDescription") || "Factors in grocery cost, walking distance, and missing items to find the best overall store."}
                            </p>
                            {compareResult.smartRecommendation.map(function (rec, idx) {
                        var _a, _b;
                        var storeResult = recalculatedResults.find(function (s) { return s.storeId === rec.storeId; });
                        var loyaltySavings = storeResult ? storeResult.items.reduce(function (sum, item) {
                            var _a, _b, _c;
                            if (!((_a = item.match) === null || _a === void 0 ? void 0 : _a.loyaltyPrice))
                                return sum;
                            var listItem = list.items.find(function (li) { return li.itemName === item.itemName; });
                            var qty = (_b = listItem === null || listItem === void 0 ? void 0 : listItem.quantity) !== null && _b !== void 0 ? _b : 1;
                            var isPack = item.match.matchType === "pack";
                            var withoutLoyalty = Math.min(item.match.price, (_c = item.match.salePrice) !== null && _c !== void 0 ? _c : Infinity) * (isPack ? 1 : qty);
                            return sum + Math.max(0, withoutLoyalty - item.lineCost);
                        }, 0) : 0;
                        return (<card_1.Card key={rec.storeId} className={idx === 0 ? "border-primary border-2" : ""}>
                                  <card_1.CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className={"font-bold ".concat(chainColor[rec.storeChain] || "")}>
                                          {rec.storeName}
                                        </span>
                                        {idx === 0 && (<badge_1.Badge className="text-xs">
                                            {t("compare.bestChoice") || "Best choice"} 🎯
                                          </badge_1.Badge>)}
                                      </div>
                                      <div className="text-right">
                                        <p className="text-lg font-bold">{rec.smartScore.toFixed(2)}€</p>
                                        <p className="text-[10px] text-muted-foreground">effective cost</p>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                      <div className="bg-muted/50 rounded p-2 text-center">
                                        <p className="text-muted-foreground">Groceries</p>
                                        <p className="font-semibold">{((_a = storeResult === null || storeResult === void 0 ? void 0 : storeResult.totalCost) !== null && _a !== void 0 ? _a : rec.totalCost).toFixed(2)}€</p>
                                      </div>
                                      <div className="bg-muted/50 rounded p-2 text-center">
                                        <p className="text-muted-foreground flex items-center justify-center gap-0.5">
                                          <lucide_react_1.MapPin className="h-3 w-3"/>
                                          Distance
                                        </p>
                                        <p className="font-semibold">
                                          {rec.distanceKm !== null ? "".concat(rec.distanceKm.toFixed(1), " km") : "—"}
                                        </p>
                                        {rec.travelPenalty > 0 && (<p className="text-[10px] text-orange-500">+{rec.travelPenalty.toFixed(2)}€</p>)}
                                      </div>
                                      <div className="bg-muted/50 rounded p-2 text-center">
                                        <p className="text-muted-foreground">Found</p>
                                        <p className="font-semibold">
                                          {(_b = storeResult === null || storeResult === void 0 ? void 0 : storeResult.matchedCount) !== null && _b !== void 0 ? _b : rec.matchedCount}/{rec.totalItems}
                                        </p>
                                        {rec.missingPenalty > 0 && (<p className="text-[10px] text-red-500">+{rec.missingPenalty.toFixed(2)}€</p>)}
                                      </div>
                                    </div>
                                    {loyaltySavings > 0.005 && (<div className="flex items-center gap-1.5 text-xs text-primary mt-2">
                                        <lucide_react_1.CreditCard className="h-3.5 w-3.5 shrink-0"/>
                                        <span>{language === "lt" ? "Su lojalumo kortele" : "With loyalty card"}:</span>
                                        <span className="font-semibold text-green-600 dark:text-green-400">-{loyaltySavings.toFixed(2)}€</span>
                                      </div>)}
                                    {storeResult && (<div className="mt-3 border-t pt-2 space-y-1">
                                        {storeResult.items.map(function (item, i) {
                                    var _a, _b, _c, _d;
                                    var isClosestAlt = ((_a = item.match) === null || _a === void 0 ? void 0 : _a.status) === "closest-alt";
                                    var isUnavailable = !item.match;
                                    return (<div key={i} className={"flex items-center justify-between text-xs gap-2 ".concat(isClosestAlt ? "opacity-50" : "")}>
                                            <div className="flex-1 min-w-0 flex items-center gap-1 flex-wrap">
                                              {isUnavailable ? (<span className="text-red-400 italic">{item.itemName}</span>) : (<span className={isClosestAlt ? "text-muted-foreground" : ""}>
                                                  {item.match.productName}
                                                </span>)}
                                              {((_b = item.match) === null || _b === void 0 ? void 0 : _b.brand) && !isClosestAlt && (<span className="text-muted-foreground">({item.match.brand})</span>)}
                                              {((_c = item.match) === null || _c === void 0 ? void 0 : _c.loyaltyPrice) && !isClosestAlt && item.match.loyaltyPrice < Math.min(item.match.price, (_d = item.match.salePrice) !== null && _d !== void 0 ? _d : Infinity) && (<lucide_react_1.CreditCard className="inline h-3 w-3 text-primary"/>)}
                                              {isClosestAlt && (<badge_1.Badge variant="outline" className="text-[9px] py-0 px-1 border-amber-300 text-amber-600">
                                                  {language === "lt" ? "kita kat." : "diff. cat."}
                                                </badge_1.Badge>)}
                                            </div>
                                            <span className={"font-medium shrink-0 ".concat(isUnavailable ? "text-red-400 italic" : isClosestAlt ? "text-muted-foreground line-through" : "")}>
                                              {isUnavailable
                                            ? (language === "lt" ? "nerasta" : "n/a")
                                            : isClosestAlt
                                                ? "—"
                                                : "".concat(item.lineCost.toFixed(2), "\u20AC")}
                                            </span>
                                          </div>);
                                })}
                                      </div>)}
                                  </card_1.CardContent>
                                </card_1.Card>);
                    })}
                          </tabs_1.TabsContent>)}

                        <tabs_1.TabsContent value="single" className="space-y-4 mt-4">
                          {(function () {
                    var sorted = __spreadArray([], recalculatedResults, true).sort(function (a, b) {
                        if (a.matchedCount !== b.matchedCount)
                            return b.matchedCount - a.matchedCount;
                        return a.totalCost - b.totalCost;
                    });
                    var maxCost = Math.max.apply(Math, sorted.map(function (s) { return s.totalCost; }));
                    return sorted.map(function (sr) {
                        var _a;
                        var missingItems = sr.items.filter(function (i) { return !i.match; });
                        var savings = sr.storeId !== ((_a = sorted[sorted.length - 1]) === null || _a === void 0 ? void 0 : _a.storeId)
                            ? maxCost - sr.totalCost
                            : null;
                        var srLoyaltySavings = sr.items.reduce(function (sum, item) {
                            var _a, _b, _c;
                            if (!((_a = item.match) === null || _a === void 0 ? void 0 : _a.loyaltyPrice))
                                return sum;
                            var listItem = list.items.find(function (li) { return li.itemName === item.itemName; });
                            var qty = (_b = listItem === null || listItem === void 0 ? void 0 : listItem.quantity) !== null && _b !== void 0 ? _b : 1;
                            var isPack = item.match.matchType === "pack";
                            var withoutLoyalty = Math.min(item.match.price, (_c = item.match.salePrice) !== null && _c !== void 0 ? _c : Infinity) * (isPack ? 1 : qty);
                            return sum + Math.max(0, withoutLoyalty - item.lineCost);
                        }, 0);
                        return (<card_1.Card key={sr.storeId} className={sr.storeId === (cheapestRecalc === null || cheapestRecalc === void 0 ? void 0 : cheapestRecalc.storeId) ? "border-primary border-2" : ""}>
                                  <card_1.CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={"font-bold ".concat(chainColor[sr.storeChain] || "")}>
                                          {sr.storeName}
                                        </span>
                                        {sr.storeId === (cheapestRecalc === null || cheapestRecalc === void 0 ? void 0 : cheapestRecalc.storeId) && (<badge_1.Badge className="text-xs">
                                            {t("compare.cheapestStore")} 🏆
                                          </badge_1.Badge>)}
                                        {savings !== null && savings > 0.01 && sr.storeId !== (cheapestRecalc === null || cheapestRecalc === void 0 ? void 0 : cheapestRecalc.storeId) && (<span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                            -{savings.toFixed(2)}€ {language === "lt" ? "sutaupote" : "savings"}
                                          </span>)}
                                      </div>
                                      <div className="text-right">
                                        <p className="text-lg font-bold">{sr.totalCost.toFixed(2)}€</p>
                                        <p className="text-xs text-muted-foreground">
                                          {sr.matchedCount}/{list.items.length} {language === "lt" ? "rasta" : "found"}
                                        </p>
                                        {srLoyaltySavings > 0.005 && (<div className="flex items-center gap-1 justify-end text-[10px] text-primary mt-0.5">
                                            <lucide_react_1.CreditCard className="h-3 w-3"/>
                                            <span className="text-green-600 dark:text-green-400 font-semibold">-{srLoyaltySavings.toFixed(2)}€</span>
                                          </div>)}
                                      </div>
                                    </div>
                                    <ul className="space-y-1.5">
                                      {sr.items.map(function (item, i) {
                                var _a, _b;
                                var isClosestAlt = ((_a = item.match) === null || _a === void 0 ? void 0 : _a.status) === "closest-alt";
                                var isUnavailable = !item.match;
                                return (<li key={i} className={"flex items-center gap-2 text-sm ".concat(isClosestAlt ? "opacity-50" : "")}>
                                          {((_b = item.match) === null || _b === void 0 ? void 0 : _b.imageUrl) && !isClosestAlt && (<img src={item.match.imageUrl} alt="" className="w-6 h-6 object-contain rounded shrink-0"/>)}
                                          <div className="flex-1 min-w-0">
                                            {isUnavailable ? (<span className="text-red-400 italic">{item.itemName} — {language === "lt" ? "nerasta" : "not available"}</span>) : isClosestAlt ? (<div>
                                                <span className="text-muted-foreground">{item.match.productName}</span>
                                                <badge_1.Badge variant="outline" className="text-[9px] py-0 px-1 ml-1 border-amber-300 text-amber-600">
                                                  {language === "lt" ? "kita kat." : "diff. cat."}
                                                </badge_1.Badge>
                                              </div>) : (<span>
                                                {item.match.productName}
                                                {item.match && (<span className="text-xs text-muted-foreground ml-1">
                                                    {item.match.brand && "".concat(item.match.brand)}
                                                    {item.match.brand && item.match.weightValue && " · "}
                                                    {item.match.weightValue && item.match.weightUnit && "".concat(item.match.weightValue).concat(item.match.weightUnit)}
                                                  </span>)}
                                              </span>)}
                                          </div>
                                          <span className={"font-medium shrink-0 ".concat(isUnavailable ? "text-red-400" : isClosestAlt ? "text-muted-foreground line-through" : "")}>
                                            {isUnavailable ? "—" : isClosestAlt ? "—" : "".concat(item.lineCost.toFixed(2), "\u20AC")}
                                          </span>
                                        </li>);
                            })}
                                    </ul>
                                    {missingItems.length > 0 && (<div className="mt-2 pt-2 border-t">
                                        <p className="text-xs text-red-500">
                                          ⚠️ {missingItems.length} {language === "lt" ? "produktų nerasta:" : "items not available:"}{" "}
                                          {missingItems.map(function (i) { return i.itemName; }).join(", ")}
                                        </p>
                                      </div>)}
                                  </card_1.CardContent>
                                </card_1.Card>);
                    });
                })()}
                        </tabs_1.TabsContent>

                        <tabs_1.TabsContent value="split" className="space-y-4 mt-4">
                          {splitRecalc && (<card_1.Card className="border-primary border-2">
                              <card_1.CardContent className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="font-bold">{t("compare.splitShopping")}</span>
                                  <p className="text-lg font-bold">{splitRecalc.totalCost.toFixed(2)}€</p>
                                </div>
                                <ul className="space-y-2">
                                  {splitRecalc.items.map(function (item, i) { return (<li key={i} className="flex items-center justify-between text-sm gap-2">
                                      <div className="flex-1 min-w-0">
                                        <p className="truncate">
                                          {item.match ? item.match.productName : item.itemName}
                                        </p>
                                        {item.match && (<p className="text-xs text-muted-foreground truncate">
                                            {item.match.brand && "".concat(item.match.brand)}
                                            {item.match.brand && item.match.weightValue && " · "}
                                            {item.match.weightValue && item.match.weightUnit && "".concat(item.match.weightValue).concat(item.match.weightUnit)}
                                          </p>)}
                                      </div>
                                      <badge_1.Badge variant="outline" className={"text-xs shrink-0 ".concat(chainColor[item.bestStoreChain] || "")}>
                                        {item.bestStoreName}
                                      </badge_1.Badge>
                                      <span className="font-medium shrink-0">
                                        {item.bestPrice > 0 ? "".concat(item.bestPrice.toFixed(2), "\u20AC") : t("compare.notFound")}
                                      </span>
                                    </li>); })}
                                </ul>
                              </card_1.CardContent>
                            </card_1.Card>)}
                        </tabs_1.TabsContent>
                      </tabs_1.Tabs>
                    </card_1.CardContent>
                  </card_1.Card>
                </div>)}
            </>)}
        </tabs_1.TabsContent>
      </tabs_1.Tabs>

      {showBrandPicker && dominantCategory && (<BrandPickerModal_1.BrandPickerModal categoryId={dominantCategory} categoryName={dominantCategory} currentBrand={(0, brandPreferences_1.getPreferredBrand)(dominantCategory)} onSelect={function (brand) {
                if (brand) {
                    setNewItem(brand + " " + newItem.trim().replace(new RegExp("^".concat(brand, "\\s*"), "i"), ""));
                }
            }} onClose={function () { return setShowBrandPicker(false); }}/>)}

      {previewProductId !== null && (<ProductPreviewModal_1.ProductPreviewModal productId={previewProductId} onClose={function () { setPreviewProductId(null); setPreviewSourceItemName(null); }} addToListLabel={previewSourceItemName ? "Select for \"".concat(previewSourceItemName, "\"") : "Add to list"} onAddToList={function (name, weightValue, weightUnit) { return __awaiter(_this, void 0, void 0, function () {
                var sourceItem, packs_1, pinnedId_1, items, closedSourceItemName_1, similar, numericKeyed_2, _i, _a, _b, k, v, _c, items;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            if (!list)
                                return [2 /*return*/];
                            if (!previewSourceItemName) return [3 /*break*/, 7];
                            sourceItem = list.items.find(function (i) { return i.itemName === previewSourceItemName; });
                            packs_1 = sourceItem
                                ? calcPacksNeeded(sourceItem.quantity, sourceItem.unit, weightValue, weightUnit)
                                : 1;
                            pinnedId_1 = previewProductId;
                            items = list.items.map(function (i) {
                                return i.itemName === previewSourceItemName
                                    ? __assign(__assign({}, i), { pinnedProductId: pinnedId_1, quantity: packs_1, unit: null }) : i;
                            });
                            setList(__assign(__assign({}, list), { items: items }));
                            closedSourceItemName_1 = previewSourceItemName;
                            setPreviewSourceItemName(null);
                            setPreviewProductId(null);
                            setParsedPreview("Selected: ".concat(name).concat(packs_1 > 1 ? " \u00D7".concat(packs_1) : ""));
                            setTimeout(function () { return setParsedPreview(null); }, 3000);
                            return [4 /*yield*/, saveItems(items)];
                        case 1:
                            _d.sent();
                            if (!pinnedId_1) return [3 /*break*/, 6];
                            setSimilarLoading(function (prev) { return new Set(__spreadArray(__spreadArray([], prev, true), [closedSourceItemName_1], false)); });
                            _d.label = 2;
                        case 2:
                            _d.trys.push([2, 4, 5, 6]);
                            return [4 /*yield*/, fetch("/api/products/similar", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ productId: pinnedId_1 }),
                                }).then(function (r) { return r.json(); })];
                        case 3:
                            similar = _d.sent();
                            numericKeyed_2 = {};
                            for (_i = 0, _a = Object.entries(similar); _i < _a.length; _i++) {
                                _b = _a[_i], k = _b[0], v = _b[1];
                                numericKeyed_2[Number(k)] = v;
                            }
                            setSimilarByItem(function (prev) {
                                var _a;
                                return (__assign(__assign({}, prev), (_a = {}, _a[closedSourceItemName_1] = numericKeyed_2, _a)));
                            });
                            return [3 /*break*/, 6];
                        case 4:
                            _c = _d.sent();
                            return [3 /*break*/, 6];
                        case 5:
                            setSimilarLoading(function (prev) {
                                var next = new Set(prev);
                                next.delete(closedSourceItemName_1);
                                return next;
                            });
                            return [7 /*endfinally*/];
                        case 6: return [3 /*break*/, 9];
                        case 7:
                            items = __spreadArray(__spreadArray([], list.items, true), [{ itemName: name, quantity: 1, unit: null, checked: false }], false);
                            setList(__assign(__assign({}, list), { items: items }));
                            setNewItem("");
                            setPickedSuggestion(null);
                            setSuggestions([]);
                            setShowSuggestions(false);
                            setParsedPreview("Added: ".concat(name));
                            setTimeout(function () { return setParsedPreview(null); }, 3000);
                            return [4 /*yield*/, saveItems(items)];
                        case 8:
                            _d.sent();
                            _d.label = 9;
                        case 9: return [2 /*return*/];
                    }
                });
            }); }}/>)}
    </div>);
}
