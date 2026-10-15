const express = require('express');
const router = express.Router();
const mariaDB = require('../db/maria');

const DB_NAME = 'recaudacion2'; // Solo para ctacte
const DB_RECAUDACION = 'recaudacion2'; 
const postgresDB = require('../db/postgres');

const { calculateLegacyInterest } = require('../utils/interestUtils');

function getNormalizedConceptName(name) {
    if (!name) return 'Sin Concepto';
    const lower = name.toLowerCase().trim();
    
    if (lower.includes('propiedad raíz') || lower.includes('propiedad raiz') || lower.includes('tasas x servicios') || lower.includes('tasas por servicios')) {
        return 'Tasas por Servicios';
    }
    if (lower.includes('bomberos') || lower.includes('bombero')) {
        return 'Aportes a Bomberos Voluntarios';
    }
    if (lower.includes('insp, comercio') || lower.includes('inspección com') || lower.includes('inspeccion com') || lower.includes('derechos de insp, comercio, ind. y servicios') || lower.includes('derecho inspección com') || lower.includes('derecho inspeccion com')) {
        return 'Derechos de Inspección, Comercio, Ind. y Servicios';
    }
    if (lower.includes('cementerio')) {
        return 'Derechos de Cementerio';
    }
    if (lower.includes('publicidad')) {
        return 'Derechos de Publicidad y Propaganda';
    }
    if (lower.includes('edificación') || lower.includes('edificacion')) {
        return 'Derechos de Edificación';
    }
    if (lower.includes('antena')) {
        return 'Derechos de Antena de Telefonía Móvil';
    }
    if (lower.includes('multas de padrones') || lower.includes('multa de padron')) {
        return 'Multas de Padrones';
    }
    if (lower.includes('multas de comercio') || lower.includes('multa de comercio') || lower.includes('multas de comercios')) {
        return 'Multas de Comercios';
    }
    if (lower.includes('acarreo')) {
        return 'Acarreo de Vehículos';
    }
    if (lower.includes('fondos de terceros')) {
        return 'Fondos de Terceros';
    }
    if (lower.includes('intereses') || lower.includes('recargos')) {
        return 'Intereses, Actualizaciones y Recargos';
    }
    if (lower.includes('pagoctacte') || lower.includes('facilidades') || lower.includes('facilidad')) {
        return 'Saldo de Facilidades / Convenios';
    }

    // Capitalize first letter of each word as fallback
    return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function getRawConceptMatches(normalizedName) {
    if (!normalizedName) return [];
    
    const lower = normalizedName.toLowerCase().trim();
    
    if (lower.includes('tasas por servicios')) {
        return ['tasas x servicios', 'tasas por servicios', 'servicios a la propiedad raíz', 'servicios a la propiedad raiz', 'tasas x servicios a la prop. raiz'];
    }
    if (lower.includes('bomberos')) {
        return ['aporte bomberos guaymallen', 'aportes a bomberos voluntarios de guaymallen', 'aporte bomberos voluntarios de guaymallen', 'aportes a bomberos voluntarios'];
    }
    if (lower.includes('inspección, comercio') || lower.includes('inspeccion, comercio')) {
        return ['derecho inspección com. ind.', 'derecho inspeccion com. ind.', 'derechos de insp, comercio, ind. y servicios', 'derecho insp, comercio, ind. y servicios'];
    }
    if (lower.includes('cementerio')) {
        return ['derecho de cementerio', 'derechos de cementerio', 'cementerio'];
    }
    if (lower.includes('publicidad')) {
        return ['derechos de publicidad y propaganda', 'derecho de publicidad', 'publicidad y propaganda'];
    }
    if (lower.includes('edificación') || lower.includes('edificacion')) {
        return ['derechos de edificación', 'derecho de edificación', 'derechos de edificacion', 'derecho de edificacion'];
    }
    if (lower.includes('antena')) {
        return ['derechos de antena de telefonía móvil', 'derecho de antena de telefonia movil', 'derecho de antena', 'antena'];
    }
    if (lower.includes('multas de padrones')) {
        return ['multas de padrones', 'multa de padrones', 'multas de padron'];
    }
    if (lower.includes('multas de comercios') || lower.includes('multas de comercio')) {
        return ['multas de comercios', 'multa de comercios', 'multas de comercio', 'multa de comercio'];
    }
    if (lower.includes('acarreo')) {
        return ['acarreo de vehículos', 'acarreo de vehiculos', 'acarreo'];
    }
    if (lower.includes('fondos de terceros')) {
        return ['fondos de terceros', 'fondo de terceros'];
    }
    if (lower.includes('intereses')) {
        return ['intereses, actualizaciones y recargos', 'intereses', 'recargos'];
    }
    
    return [normalizedName];
}

// MAIN SEARCH ROUTE
router.get('/legacy/search', async (req, res) => {
    const { officeId, account, onlyDebt, toDate, filterYear, filterMonth, showQuotaDetail } = req.query;
    let conn;
    const isOnlyDebt = onlyDebt === 'true';

    console.log(`\n--- [DEBUG] /legacy/search called ---`);
    console.log(`PARAMS: officeId=${officeId}, account=${account}, onlyDebt=${onlyDebt}, toDate=${toDate}, showQuotaDetail=${showQuotaDetail}`);

    try {
        conn = await mariaDB.getRemoteConnection();
        await conn.query(`USE ${DB_RECAUDACION}`);

        const accList = Array.isArray(account) ? account : (account ? [account.toString().trim()] : []);
        const queryDate = toDate || new Date().toISOString().split('T')[0];

        console.log(`accList:`, accList);

        // Dynamic Legacy Account Mapper (Smart Resolver for Office 3 & 5)
        const mappedAccList = [];
        const originalToMappedMap = {}; // Maps mapped account -> search key

        for (const acc of accList) {
            let mappedAcc = acc;
            console.log(`[RESOLVER DEBUG] Processing account: '${acc}'`);
            
            // If the query is for Deudores Varios (Office 3) or Ingresos Varios (Office 5)
            if ((officeId == '3' || officeId == '5') && /^\d+$/.test(acc)) {
                try {
                    console.log(`[RESOLVER DEBUG] Querying Postgres for percod = '${acc}'`);
                    // 1. Find if this is a valid Postgres percod
                    const pgRes = await postgresDB.query(
                        "SELECT percuiltipo, percuilnro, percuildigver FROM public.persona WHERE percod = $1",
                        [acc]
                    );
                    
                    console.log(`[RESOLVER DEBUG] Postgres matches:`, pgRes.rows.length);
                    
                    if (pgRes.rows.length > 0) {
                        const { percuiltipo, percuilnro, percuildigver } = pgRes.rows[0];
                        const fullCuit = `${percuiltipo}${percuilnro}${percuildigver}`;
                        console.log(`[RESOLVER DEBUG] CUIT found in Postgres: '${fullCuit}'`);
                        
                        // 2. Find corresponding legacy citizen CucuPers in infogov
                        const mariaPers = await conn.query(
                            "SELECT CucuPers FROM infogov.persona WHERE CucuPers = ? OR CuitPers = ?",
                            [fullCuit, fullCuit]
                        );
                        
                        console.log(`[RESOLVER DEBUG] MariaDB person matches in infogov:`, mariaPers.length);
                        
                        if (mariaPers.length > 0) {
                            const cucuPers = mariaPers[0].CucuPers;
                            console.log(`[RESOLVER DEBUG] CucuPers found: '${cucuPers}'`);
                            
                            // 3. Find CuenCtct in relacion for this office and citizen
                            const relRes = await conn.query(
                               "SELECT CuenCtct FROM relacion WHERE CodiOfic = ? AND CucuPers = ?",
                                [officeId, cucuPers]
                            );
                            
                            console.log(`[RESOLVER DEBUG] relacion table matches for office ${officeId}:`, relRes.length);
                            
                            if (relRes.length > 0) {
                                mappedAcc = relRes[0].CuenCtct.toString().trim();
                                console.log(`[SMART RESOLVER SUCCESS] Mapped search account '${acc}' to legacy account '${mappedAcc}'`);
                            }
                        }
                    }
                } catch (err) {
                    console.error("[SMART RESOLVER ERROR]:", err);
                }
            }
            
            mappedAccList.push(mappedAcc);
            originalToMappedMap[mappedAcc] = acc;
        }

        // Lookup account name based on office using mapped accounts
        let accountNameMap = {};
        for (const acc of mappedAccList) {
            let nameQuery = "";
            let nameParams = [acc];
            
            if (officeId == '7' || officeId == '13') { // Antenas (7 in remote, 13 in local/old)
                nameQuery = "SELECT RazoCome as name FROM antena WHERE CodiCome = ?";
            } else if (officeId == '2') { // Comercio
                nameQuery = "SELECT RazoCome as name FROM comercio WHERE CodiCome = ?";
            } else if (officeId == '6' || officeId == '3') { // Publicidad (6 in remote, 3 in local/old)
                nameQuery = "SELECT RazoCome as name FROM publicidad WHERE CodiCome = ?";
            } else if (officeId == '4') { // Cementerio
                nameQuery = "SELECT RazoCome as name FROM cementerio WHERE CodiCome = ?";
            }

            if (nameQuery) {
                try {
                    const nameRes = await conn.query(nameQuery, nameParams);
                    if (nameRes.length > 0) accountNameMap[acc] = nameRes[0].name;
                } catch (e) { console.error("Error fetching account name:", e); }
            }
        }

        let allResults = [];

        for (const acc of mappedAccList) {
            let whereClause = "WHERE t.CodiOfic = ? AND t.CuenCtct = ?";
            let params = [officeId, acc];

            if (filterYear) {
                whereClause += " AND t.PeriCtct = ?";
                params.push(filterYear);
            }
            if (filterMonth) {
                whereClause += " AND t.BimeCtct = ?";
                params.push(filterMonth);
            }

            // 1. Get main debt from ctacte
            const isDetail = showQuotaDetail === 'true';
            let mainDebtQuery;

            if (isDetail) {
                mainDebtQuery = `
                    SELECT 
                        t.PeriCtct, t.BimeCtct, t.CuotDefa, t.FeveCtct, 
                        IFNULL(c.DetaConc, t.DetaCtct) as DetaCtct, 
                        IFNULL(t.DebeCtct, 0) as DebeCtct, 
                        IFNULL(t.CredCtct, 0) as CredCtct,
                        t.NumeAcpa, t.FeenAcpa as FechaPago,
                        t.NumeBole, t.PeriBole, t.NumeApre, t.CodiFapa,
                        t.PeriInfo, t.CodiConc,
                        'CTACTE' as Source,
                        t.CuenCtct as CuenCtct
                    FROM ${DB_NAME}.ctacte t
                    LEFT JOIN ${DB_RECAUDACION}.concepto c ON c.PeriInfo = t.PeriInfo AND c.CodiConc = t.CodiConc
                    ${whereClause}
                `;
            } else {
                mainDebtQuery = `
                    SELECT 
                        t.PeriCtct, t.BimeCtct, MAX(t.CuotDefa) as CuotDefa, MAX(t.FeveCtct) as FeveCtct, 
                        IFNULL(c.DetaConc, MAX(t.DetaCtct)) as DetaCtct, 
                        SUM(IFNULL(t.DebeCtct, 0)) as DebeCtct, 
                        SUM(IFNULL(t.CredCtct, 0)) as CredCtct,
                        MAX(t.NumeAcpa) as NumeAcpa, MAX(t.FeenAcpa) as FechaPago,
                        MAX(t.NumeBole) as NumeBole, MAX(t.PeriBole) as PeriBole, MAX(t.NumeApre) as NumeApre, MAX(t.CodiFapa) as CodiFapa,
                        MAX(t.PeriInfo) as PeriInfo, MAX(t.CodiConc) as CodiConc,
                        'CTACTE' as Source,
                        t.CuenCtct as CuenCtct
                    FROM ${DB_NAME}.ctacte t
                    LEFT JOIN ${DB_RECAUDACION}.concepto c ON c.PeriInfo = t.PeriInfo AND c.CodiConc = t.CodiConc
                    ${whereClause}
                    GROUP BY t.PeriCtct, t.BimeCtct, t.PeriInfo, t.CodiConc, t.CuenCtct
                `;
            }

            const mainResults = await conn.query(mainDebtQuery, params);

            // 2. Get payment plan installments (facipago/detafapa)
            let planWhereClause = `WHERE f.CodiOfic = ? AND f.CuenCtct = ? AND f.EstaFapa = 'Activa'`;
            let planParams = [officeId, acc];

            if (filterYear) {
                planWhereClause += " AND f.PeriInfo = ?";
                planParams.push(filterYear);
            }
            if (filterMonth) {
                planWhereClause += " AND d.CuotDefa = ?";
                planParams.push(filterMonth);
            }

            const planDebtQuery = `
                SELECT 
                    f.PeriInfo as PeriCtct, d.CuotDefa as BimeCtct, d.CuotDefa, d.FeveDefa as FeveCtct,
                    CONCAT('Plan ', f.CodiFapa, ' - Cuota ', d.CuotDefa) as DetaCtct,
                    d.TotaDefa as DebeCtct,
                    IF(d.FepaDefa IS NOT NULL, d.TotaDefa, 0) as CredCtct,
                    0 as NumeAcpa, d.FepaDefa as FechaPago,
                    0 as NumeBole, 0 as NumeApre, f.CodiFapa,
                    f.PeriInfo, d.CodiFapa as CodiConc,
                    'PLAN' as Source,
                    f.CuenCtct as CuenCtct
                FROM facipago f
                INNER JOIN detafapa d ON d.CodiFapa = f.CodiFapa
                ${planWhereClause}
            `;
            const planResults = await conn.query(planDebtQuery, planParams);

            const combined = [...mainResults, ...planResults];

            // 3. Apply Interest Logic and Format
            const finalResults = combined.map(row => {
                const debe = parseFloat(row.DebeCtct || 0);
                const haber = parseFloat(row.CredCtct || 0);
                const capital = Math.max(0, debe - haber);

                let reca = 0;
                if (capital > 0.01) {
                    reca = calculateLegacyInterest(row.FeveCtct, queryDate, capital);
                }

                // Restore original searched account code for parity alignment
                const originalSearchAcc = originalToMappedMap[row.CuenCtct.toString().trim()] || row.CuenCtct;

                return {
                    ...row,
                    DebeCtct: debe,
                    RecaCtct: reca,
                    CredCtct: haber,
                    TotaCtct: Math.max(0, (debe + reca) - haber),
                    DetaCtct: (row.DetaCtct || '').trim() ? getNormalizedConceptName((row.DetaCtct || '').trim()) : `Mov: ${row.MoviCtct || ''}`,
                    hasApremio: parseInt(row.NumeApre || 0) > 0,
                    hasPlan: parseInt(row.CodiFapa || 0) > 0,
                    AccountName: accountNameMap[acc] || null,
                    CuenCtct: originalSearchAcc
                };
            });

            allResults.push(...finalResults);
        }

        // Filter by onlyDebt at the group level (Period + Month + Account)
        if (isOnlyDebt) {
            const groupBalances = {};
            allResults.forEach(r => {
                const accKey = r.CuenCtct ? r.CuenCtct.toString().trim().replace(/^0+/, '') || '0' : '';
                const key = `${r.PeriCtct}-${r.BimeCtct}-${accKey}`;
                if (!groupBalances[key]) groupBalances[key] = 0;
                groupBalances[key] += (parseFloat(r.DebeCtct || 0) - parseFloat(r.CredCtct || 0));
            });

            allResults = allResults.filter(r => {
                const accKey = r.CuenCtct ? r.CuenCtct.toString().trim().replace(/^0+/, '') || '0' : '';
                const key = `${r.PeriCtct}-${r.BimeCtct}-${accKey}`;
                return (groupBalances[key] || 0) > 0.01;
            });
        }

        // Sort by period descending
        allResults.sort((a, b) => {
            if (parseInt(b.PeriCtct) !== parseInt(a.PeriCtct)) return parseInt(b.PeriCtct) - parseInt(a.PeriCtct);
            return parseInt(a.BimeCtct) - parseInt(b.BimeCtct);
        });

        res.json(allResults);

    } catch (err) {
        console.error('Error in ctacteFn search:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// EXPERIMENTAL POSTGRES SEARCH WITH LEGACY INTERESTS
router.get('/new/search', async (req, res) => {
    const { officeId, account, accounts, searchType, percod, toDate, onlyDebt, showQuotaDetail, filterYear, filterMonth } = req.query;

    try {
        let accountList = accounts ? (Array.isArray(accounts) ? accounts : [accounts]) : (account ? [account] : []);
        let resolvedInfo = [];

        if (searchType === 'person' && percod) {
            const resolutionQuery = `
                SELECT DISTINCT t.tbecod, t.tpotribcod as "officeId"
                FROM public.generacioncuota gc
                JOIN public.tributo t ON gc.genctatribcod = t.tribcod
                WHERE gc.genctapercod = $1
            `;
            const resolutionRes = await postgresDB.query(resolutionQuery, [percod]);
            resolvedInfo = resolutionRes.rows;
            accountList = resolvedInfo.map(r => r.tbecod);
        }

        if (accountList.length === 0) return res.json([]);

        // Clean leading zeroes from account list for Postgres (e.g. '03933' -> '3933')
        accountList = accountList.map(a => a.toString().trim().replace(/^0+/, '') || '0');

        const placeholders = accountList.map((_, i) => `$${i + 1}`).join(',');

        let query;
        if (showQuotaDetail === 'true') {
            query = `
                SELECT 
                    cc.ctactecod, gc.genctaancta as "PeriCtct", gc.genctanrocta as "BimeCtct", 
                    cc.ctactefchalta, gc.genctafchvto as "FeveCtct",
                    COALESCE(gcd.genctadetimp, gc.genctaimpcta) as "DebeCtct",
                    cc.ctacteognmov, gc.genctacednro as "NumeApre",
                    cc.cabpgoctactecod as "NumeAcpa", pgo.cabpgoctactefchpgo as "FechaPago",
                    cc.plnpgocod, t.tbecod as "CuenCtct", tt.tpotribnom as "TipoTributo",
                    COALESCE(rt.rectrfdsc, tt.tpotribnom) as "DetaCtct",
                    tt.tpotribcod as "officeId", p.percod as "PersonId",
                    TRIM(p.pernom) as "OwnerName", cat.caonra as "Nomenclatura",
                    def.defidpab as "Pabellon", def.defidnicho as "Nicho"
                FROM public.generacioncuota gc
                LEFT JOIN public.generacioncuotadetalle gcd ON gc.genctacod = gcd.genctadetcod
                LEFT JOIN public.recursostarifa rt ON rt.rectrfcod = gcd.genctadetreccod
                LEFT JOIN public.cuentacorriente cc ON cc.genctacod = gc.genctacod
                INNER JOIN public.tributo t ON gc.genctatribcod = t.tribcod
                INNER JOIN public.tipotributo tt ON t.tpotribcod = tt.tpotribcod
                LEFT JOIN public.cabecerapagoctacte pgo ON cc.cabpgoctactecod = pgo.cabpgoctactecod
                LEFT JOIN public.persona p ON gc.genctapercod = p.percod
                LEFT JOIN public.catastro cat ON (tt.tpotribcod = 1 AND cat.caocod = t.tbecod)
                LEFT JOIN public.defuncion def ON (tt.tpotribcod = 4 AND def.defcod = t.tbecod)
                WHERE ${searchType === 'person' ? 'gc.genctapercod = $1' : `t.tbecod IN (${placeholders})`}
                AND tt.tpotribcod = \$${searchType === 'person' ? '2' : accountList.length + 1}
                ${filterYear ? `AND gc.genctaancta = ${parseInt(filterYear)}` : ''}
                ${filterMonth ? `AND gc.genctanrocta = ${parseInt(filterMonth)}` : ''}
                ORDER BY gc.genctaancta DESC, gc.genctanrocta ASC, gcd.genctadetlin ASC
                LIMIT 4000
            `;
        } else {
            query = `
                SELECT 
                    cc.ctactecod, gc.genctaancta as "PeriCtct", gc.genctanrocta as "BimeCtct", 
                    cc.ctactefchalta, gc.genctafchvto as "FeveCtct",
                    gc.genctaimpcta as "DebeCtct",
                    cc.ctacteognmov, gc.genctacednro as "NumeApre",
                    cc.cabpgoctactecod as "NumeAcpa", pgo.cabpgoctactefchpgo as "FechaPago",
                    cc.plnpgocod, t.tbecod as "CuenCtct", tt.tpotribnom as "TipoTributo",
                    tt.tpotribcod as "officeId", p.percod as "PersonId",
                    TRIM(p.pernom) as "OwnerName", cat.caonra as "Nomenclatura",
                    def.defuncion_id as "Pabellon", def.defuncion_nicho as "Nicho"
                FROM public.cuentacorriente cc
                INNER JOIN public.generacioncuota gc ON cc.genctacod = gc.genctacod
                INNER JOIN public.tributo t ON gc.genctatribcod = t.tribcod
                INNER JOIN public.tipotributo tt ON t.tpotribcod = tt.tpotribcod
                LEFT JOIN public.cabecerapagoctacte pgo ON cc.cabpgoctactecod = pgo.cabpgoctactecod
                LEFT JOIN public.persona p ON gc.genctapercod = p.percod
                LEFT JOIN public.catastro cat ON (tt.tpotribcod = 1 AND cat.caocod = t.tbecod)
                WHERE ${searchType === 'person' ? 'gc.genctapercod = $1' : `t.tbecod IN (${placeholders})`}
                AND tt.tpotribcod = \$${searchType === 'person' ? '2' : accountList.length + 1}
                ${filterYear ? `AND gc.genctaancta = ${parseInt(filterYear)}` : ''}
                ${filterMonth ? `AND gc.genctanrocta = ${parseInt(filterMonth)}` : ''}
                ORDER BY gc.genctaancta DESC, gc.genctanrocta ASC
                LIMIT 2000
            `;
        }

        const queryParams = searchType === 'person' ? [percod, officeId] : [...accountList, officeId];
        const result = await postgresDB.query(query, queryParams);

        console.log(`[POSTGRES DEBUG] Query for ${accountList.join(',')} returned ${result.rows.length} rows. showQuotaDetail: ${showQuotaDetail}`);

        const queryDate = toDate || new Date().toISOString().split('T')[0];

        const payOnlyCtacteCods = new Set();
        result.rows.forEach(row => {
            const dbVal = parseFloat(row.DebeCtct || 0);
            if (dbVal < 0 && row.ctactecod) {
                payOnlyCtacteCods.add(row.ctactecod.toString());
            }
        });

        const mappedResults = result.rows.map(row => {
            const dbVal = parseFloat(row.DebeCtct || 0);
            let debe = 0;
            let haber = 0;
            let reca = 0;
            let isPaid = false;

            const ognMov = parseInt(row.ctacteognmov || 0);
            const feve = row.FeveCtct;

            const detailName = (row.TipoTributo || '').toLowerCase();
            const isSurcharge = detailName.includes('recargo') || detailName.includes('interes');
            const isCapital = ognMov === 1 || (ognMov === 0 && !isSurcharge);

            if (dbVal < 0) {
                // If amount is negative, it is a payment/credit (Haber)
                haber = Math.abs(dbVal);
                debe = 0;
                isPaid = true;
            } else {
                debe = dbVal;
                const hasSeparatePayments = row.ctactecod && payOnlyCtacteCods.has(row.ctactecod.toString());
                isPaid = parseInt(row.NumeAcpa || 0) > 0 && !hasSeparatePayments;
                if (isPaid) {
                    haber = debe;
                } else {
                    haber = 0;
                    if (isCapital && feve) {
                        const calculationEndDate = queryDate;
                        reca = calculateLegacyInterest(feve, calculationEndDate, debe);
                    }
                }
            }

            return {
                ...row,
                PeriCtct: parseInt(row.PeriCtct),
                BimeCtct: parseInt(row.BimeCtct),
                DebeCtct: debe,
                RecaCtct: reca,
                CredCtct: haber,
                TotaCtct: isPaid ? 0 : (debe + reca),
                TipoTributo: (row.TipoTributo || '').trim(),
                DetaCtct: (row.DetaCtct || '').trim() ? getNormalizedConceptName((row.DetaCtct || '').trim()) : (row.TipoTributo || '').trim() ? getNormalizedConceptName((row.TipoTributo || '').trim()) : `Mov: ${ognMov}`,
                hasApremio: parseInt(row.NumeApre || 0) > 0,
                hasPlan: parseInt(row.plnpgocod || 0) > 0,
            };
        });
 
        let finalFiltered = mappedResults;
        if (onlyDebt === 'true') {
            const groupBalances = {};
            mappedResults.forEach(r => {
                const accKey = r.CuenCtct ? r.CuenCtct.toString().trim().replace(/^0+/, '') || '0' : '';
                const key = `${r.PeriCtct}-${r.BimeCtct}-${accKey}`;
                if (!groupBalances[key]) groupBalances[key] = 0;
                groupBalances[key] += (parseFloat(r.DebeCtct || 0) - parseFloat(r.CredCtct || 0));
            });

            finalFiltered = mappedResults.filter(r => {
                const accKey = r.CuenCtct ? r.CuenCtct.toString().trim().replace(/^0+/, '') || '0' : '';
                const key = `${r.PeriCtct}-${r.BimeCtct}-${accKey}`;
                return (groupBalances[key] || 0) > 0.01;
            });
        }

        res.json(finalFiltered);
    } catch (err) {
        console.error('Error in Postgres Fn search:', err);
        res.status(500).json({ error: err.message });
    }
});

// REPORT: GENERAL COMPARISON OF ALL PADRONES
router.get('/report/comparison', async (req, res) => {
    const { officeId, page = 1, limit = 20, search, filterYear, filterMonth, filterConcept } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let conn;

    try {
        conn = await mariaDB.getRemoteConnection();
        await conn.query(`USE ${DB_RECAUDACION}`);

        const offId = parseInt(officeId);
        const pNum = parseInt(page);
        const lmt = parseInt(limit);

        // Pre-resolve concept codes to avoid slow LEFT JOIN on ctacte
        let codiConcList = [];
        if (filterConcept) {
            const matches = getRawConceptMatches(filterConcept);
            const conceptPlaceholders = matches.map(() => '?').join(',');
            const conceptRows = await conn.query(
                `SELECT DISTINCT CodiConc FROM ${DB_RECAUDACION}.concepto WHERE DetaConc IN (${conceptPlaceholders})`,
                matches
            );
            codiConcList = conceptRows.map(r => r.CodiConc.toString().trim());
        }

        const isExport = req.query.export === 'true';

        // Pre-resolve searched accounts if search parameter is present
        let searchAccs = [];
        if (search && search.trim()) {
            const term = search.trim();
            const termLike = `%${term}%`;
            const cleanTerm = term.replace(/[^0-9]/g, '');
            
            // Format cleanTerm as CUIT with dashes if it's 11 digits (e.g. 20033239832 → 20-03323983-2)
            let cuitWithDashes = null;
            if (/^\d{11}$/.test(cleanTerm)) {
                cuitWithDashes = `${cleanTerm.substring(0, 2)}-${cleanTerm.substring(2, 10)}-${cleanTerm.substring(10)}`;
            }

            // Build query params dynamically to support CUIT with and without dashes
            const queryParams = [term, cleanTerm, term]; // nro_padron, nro_doc, CUIT exact match
            if (cuitWithDashes) queryParams.push(cuitWithDashes); // CUIT formatted with dashes
            queryParams.push(termLike); // denominacion LIKE

            const cuitCondition = cuitWithDashes ? `OR CUIT = ?` : '';

            const resolveQuery = `
                SELECT DISTINCT nro_padron 
                FROM ${DB_RECAUDACION}.vpadrones_persona 
                WHERE nro_padron = ? 
                   OR nro_doc = ?
                   OR CUIT = ?
                   ${cuitCondition}
                   OR denominacion LIKE ?
                LIMIT 100
            `;
            const resolvedRows = await conn.query(resolveQuery, queryParams);

            if (resolvedRows.length > 0) {
                searchAccs = resolvedRows.map(r => r.nro_padron.toString().trim());
            } else {
                searchAccs = [term];
            }
        }

        let accList = [];
        let mariaRecords = [];
        let mariaPlans = [];
        let pgRecords = [];
        let personMap = {};

        if (isExport) {
            // 1. Fetch MariaDB Records directly filtered by office, year, month, concept
            let mariaWhere = "WHERE t.CodiOfic = ?";
            let mariaParams = [offId];
            if (filterYear) {
                mariaWhere += " AND t.PeriCtct = ?";
                mariaParams.push(parseInt(filterYear));
            }
            if (filterMonth) {
                mariaWhere += " AND t.BimeCtct = ?";
                mariaParams.push(parseInt(filterMonth));
            }
            if (filterConcept) {
                const matches = getRawConceptMatches(filterConcept);
                const conceptPlaceholders = matches.map(() => '?').join(',');
                if (codiConcList.length > 0) {
                    const codePlaceholders = codiConcList.map(() => '?').join(',');
                    mariaWhere += ` AND (t.CodiConc IN (${codePlaceholders}) OR t.DetaCtct IN (${conceptPlaceholders}))`;
                    mariaParams.push(...codiConcList, ...matches);
                } else {
                    mariaWhere += ` AND t.DetaCtct IN (${conceptPlaceholders})`;
                    mariaParams.push(...matches);
                }
            }

            if (search && search.trim()) {
                const searchVariants = [];
                searchAccs.forEach(acc => {
                    for (let i = 0; i <= 10 - acc.length; i++) {
                        searchVariants.push(acc.padStart(acc.length + i, ' '));
                    }
                });
                const uniqueVariants = [...new Set(searchVariants)];
                if (uniqueVariants.length > 0) {
                    const inPlaceholders = uniqueVariants.map(() => '?').join(',');
                    mariaWhere += ` AND t.CuenCtct IN (${inPlaceholders})`;
                    mariaParams.push(...uniqueVariants);
                } else {
                    mariaWhere += " AND 1=0";
                }
            }

            const mariaDebtQuery = `
                SELECT t.CuenCtct, t.PeriCtct, t.BimeCtct, MAX(t.FeveCtct) as FeveCtct, 
                       SUM(IFNULL(t.DebeCtct, 0) - IFNULL(t.CredCtct, 0)) as Capital,
                       SUM(IFNULL(t.DebeCtct, 0)) as DebeTotal,
                       SUM(IFNULL(t.CredCtct, 0)) as Pagado
                FROM ${DB_NAME}.ctacte t
                ${mariaWhere}
                GROUP BY t.CuenCtct, t.PeriCtct, t.BimeCtct, t.PeriInfo, t.CodiConc
                LIMIT 50000
            `;
            console.log(`[EXPORT] Running MariaDB query for office ${offId}, year ${filterYear}, month ${filterMonth}`);
            mariaRecords = await conn.query(mariaDebtQuery, mariaParams);
            console.log(`[EXPORT] MariaDB returned ${mariaRecords.length} account rows`);

            // Fetch Plans directly
            if (!filterConcept) {
                let planWhere = "WHERE f.CodiOfic = ? AND f.EstaFapa = 'Activa'";
                let planParams = [officeId];
                if (filterYear) {
                    planWhere += " AND f.PeriInfo = ?";
                    planParams.push(parseInt(filterYear));
                }
                if (filterMonth) {
                    planWhere += " AND d.CuotDefa = ?";
                    planParams.push(parseInt(filterMonth));
                }
                if (search && search.trim()) {
                    const cleanSearchAccs = searchAccs.map(a => a.replace(/^0+/, '') || '0');
                    const placeholders = cleanSearchAccs.map(() => '?').join(',');
                    planWhere += ` AND f.CuenCtct IN (${placeholders})`;
                    planParams.push(...cleanSearchAccs);
                }

                const mariaPlanQuery = `
                    SELECT f.CuenCtct, f.PeriInfo as PeriCtct, d.CuotDefa as BimeCtct, MAX(d.FeveDefa) as FeveCtct, 
                           SUM(d.TotaDefa - CASE WHEN d.FepaDefa IS NOT NULL THEN d.TotaDefa ELSE 0 END) as Capital,
                           SUM(d.TotaDefa) as DebeTotal,
                           SUM(CASE WHEN d.FepaDefa IS NOT NULL THEN d.TotaDefa ELSE 0 END) as Pagado
                    FROM ${DB_RECAUDACION}.facipago f
                    INNER JOIN ${DB_RECAUDACION}.detafapa d ON d.CodiFapa = f.CodiFapa
                    ${planWhere}
                    GROUP BY f.CuenCtct, f.PeriInfo, d.CuotDefa
                `;
                mariaPlans = await conn.query(mariaPlanQuery, planParams);
            }

            // 2. Fetch PostgreSQL Records directly
            let pgWhere = "WHERE t.tpotribcod = $1";
            let pgParams = [officeId];
            let pgParamCount = 2;
            if (filterYear) {
                pgWhere += ` AND gc.genctaancta = $${pgParamCount}`;
                pgParams.push(parseInt(filterYear));
                pgParamCount++;
            }
            if (filterMonth) {
                pgWhere += ` AND gc.genctanrocta = $${pgParamCount}`;
                pgParams.push(parseInt(filterMonth));
                pgParamCount++;
            }
            if (search && search.trim()) {
                const cleanSearchAccs = searchAccs.map(a => a.replace(/^0+/, '') || '0');
                pgWhere += ` AND t.tbecod::text = ANY($${pgParamCount})`;
                pgParams.push(cleanSearchAccs);
                pgParamCount++;
            }

            let pgDebtQuery;
            if (filterConcept) {
                const matches = getRawConceptMatches(filterConcept).map(m => m.toUpperCase().trim());
                const placeholders = matches.map((_, idx) => `$${pgParamCount + idx}`).join(',');
                pgWhere += ` AND UPPER(TRIM(BOTH ' ' FROM COALESCE(rt.rectrfdsc, tt.tpotribnom))) IN (${placeholders})`;
                pgParams.push(...matches);
                pgParamCount += matches.length;

                // GROUP BY account to avoid returning thousands of individual rows
                pgDebtQuery = `
                    SELECT t.tbecod::text as "CuenCtct",
                           gc.genctaancta as "PeriCtct",
                           MAX(gc.genctafchvto) as "FeveCtct",
                           SUM(COALESCE(gcd.genctadetimp, gc.genctaimpcta)) as "DebeCtct",
                           SUM(CASE WHEN (cc.cabpgoctactecod > 0) THEN COALESCE(gcd.genctadetimp, gc.genctaimpcta) ELSE 0 END) as "Pagado"
                    FROM public.generacioncuota gc
                    LEFT JOIN public.generacioncuotadetalle gcd ON gc.genctacod = gcd.genctadetcod
                    LEFT JOIN public.recursostarifa rt ON rt.rectrfcod = gcd.genctadetreccod
                    LEFT JOIN public.cuentacorriente cc ON cc.genctacod = gc.genctacod
                    INNER JOIN public.tributo t ON gc.genctatribcod = t.tribcod
                    INNER JOIN public.tipotributo tt ON t.tpotribcod = tt.tpotribcod
                    ${pgWhere}
                    GROUP BY t.tbecod, gc.genctaancta
                `;
            } else {
                // GROUP BY account to avoid returning thousands of individual rows
                pgDebtQuery = `
                    SELECT t.tbecod::text as "CuenCtct",
                           gc.genctaancta as "PeriCtct",
                           MAX(gc.genctafchvto) as "FeveCtct",
                           SUM(gc.genctaimpcta) as "DebeCtct",
                           SUM(CASE WHEN (cc.cabpgoctactecod > 0) THEN gc.genctaimpcta ELSE 0 END) as "Pagado"
                    FROM public.cuentacorriente cc
                    INNER JOIN public.generacioncuota gc ON cc.genctacod = gc.genctacod
                    INNER JOIN public.tributo t ON gc.genctatribcod = t.tribcod
                    ${pgWhere}
                    GROUP BY t.tbecod, gc.genctaancta
                `;
            }
            console.log(`[EXPORT] Running PG query for office ${officeId}, year ${filterYear}, month ${filterMonth}, concept ${filterConcept}`);
            const pgResult = await postgresDB.query(pgDebtQuery, pgParams);
            pgRecords = pgResult.rows;
            console.log(`[EXPORT] PG returned ${pgRecords.length} account rows`);

            // Merge unique accounts
            const allAccs = new Set([
                ...mariaRecords.map(r => r.CuenCtct.toString().trim()),
                ...mariaPlans.map(r => r.CuenCtct.toString().trim()),
                ...pgRecords.map(r => r.CuenCtct.toString().trim())
            ]);
            accList = [...allAccs].sort();

        } else {
            // Paginated logic:
            // 1. Get a page of unique accounts for this office
            let accountsQuery;
            let queryParams = [offId];
            let whereClause = "WHERE t.CodiOfic = ?";
            let fromClause = `${DB_NAME}.ctacte t`;

            if (search && search.trim()) {
                const searchVariants = [];
                searchAccs.forEach(acc => {
                    for (let i = 0; i <= 10 - acc.length; i++) {
                        searchVariants.push(acc.padStart(acc.length + i, ' '));
                    }
                });
                const uniqueVariants = [...new Set(searchVariants)];
                if (uniqueVariants.length > 0) {
                    const inPlaceholders = uniqueVariants.map(() => '?').join(',');
                    whereClause += ` AND t.CuenCtct IN (${inPlaceholders})`;
                    queryParams.push(...uniqueVariants);
                } else {
                    whereClause += " AND 1=0";
                }
            }

            if (filterYear) {
                whereClause += " AND t.PeriCtct = ?";
                queryParams.push(parseInt(filterYear));
            }

            if (filterMonth) {
                whereClause += " AND t.BimeCtct = ?";
                queryParams.push(parseInt(filterMonth));
            }

            if (filterConcept) {
                const matches = getRawConceptMatches(filterConcept);
                const conceptPlaceholders = matches.map(() => '?').join(',');
                if (codiConcList.length > 0) {
                    const codePlaceholders = codiConcList.map(() => '?').join(',');
                    whereClause += ` AND (t.CodiConc IN (${codePlaceholders}) OR t.DetaCtct IN (${conceptPlaceholders}))`;
                    queryParams.push(...codiConcList, ...matches);
                } else {
                    whereClause += ` AND t.DetaCtct IN (${conceptPlaceholders})`;
                    queryParams.push(...matches);
                }
            }

            accountsQuery = `
                SELECT t.CuenCtct 
                FROM ${fromClause} 
                ${whereClause}
                GROUP BY t.CuenCtct
                ORDER BY t.CuenCtct ASC
                LIMIT ?, ?
            `;
            queryParams.push((pNum - 1) * lmt, lmt);

            const accountsResult = await conn.query(accountsQuery, queryParams);

            if (accountsResult.length === 0) return res.json({ data: [], total: 0 });

            // Ensure unique accounts after trimming (avoid duplicates from different padding variants)
            accList = [...new Set(accountsResult.map(r => r.CuenCtct.toString().trim()))];
            const placeholders = accList.map(() => '?').join(',');

            // Clean account codes of leading zeroes
            const cleanAccList = [...new Set(accList.map(a => a.replace(/^0+/, '') || '0'))];
            const cleanPlaceholders = cleanAccList.map(() => '?').join(',');

            // 3. Fetch MariaDB Records in Bulk (Grouped by period/bimester)
            let mariaWhere = `WHERE t.CodiOfic = ? AND t.CuenCtct IN (${placeholders})`;
            let mariaParams = [officeId, ...accList];
            if (filterYear) {
                mariaWhere += " AND t.PeriCtct = ?";
                mariaParams.push(parseInt(filterYear));
            }
            if (filterMonth) {
                mariaWhere += " AND t.BimeCtct = ?";
                mariaParams.push(parseInt(filterMonth));
            }
            if (filterConcept) {
                const matches = getRawConceptMatches(filterConcept);
                const conceptPlaceholders = matches.map(() => '?').join(',');
                if (codiConcList.length > 0) {
                    const codePlaceholders = codiConcList.map(() => '?').join(',');
                    mariaWhere += ` AND (t.CodiConc IN (${codePlaceholders}) OR t.DetaCtct IN (${conceptPlaceholders}))`;
                    mariaParams.push(...codiConcList, ...matches);
                } else {
                    mariaWhere += ` AND t.DetaCtct IN (${conceptPlaceholders})`;
                    mariaParams.push(...matches);
                }
            }

            const mariaDebtQuery = `
                SELECT t.CuenCtct, t.PeriCtct, t.BimeCtct, MAX(t.FeveCtct) as FeveCtct, 
                       SUM(IFNULL(t.DebeCtct, 0) - IFNULL(t.CredCtct, 0)) as Capital,
                       SUM(IFNULL(t.DebeCtct, 0)) as DebeTotal,
                       SUM(IFNULL(t.CredCtct, 0)) as Pagado
                FROM ${DB_NAME}.ctacte t
                ${mariaWhere}
                GROUP BY t.CuenCtct, t.PeriCtct, t.BimeCtct, t.PeriInfo, t.CodiConc
            `;
            mariaRecords = await conn.query(mariaDebtQuery, mariaParams);

            // 3b. Fetch MariaDB Plan Records in Bulk
            if (!filterConcept) {
                let planWhere = `WHERE f.CodiOfic = ? AND f.CuenCtct IN (${cleanPlaceholders}) AND f.EstaFapa = 'Activa'`;
                let planParams = [officeId, ...cleanAccList];
                if (filterYear) {
                    planWhere += " AND f.PeriInfo = ?";
                    planParams.push(parseInt(filterYear));
                }
                if (filterMonth) {
                    planWhere += " AND d.CuotDefa = ?";
                    planParams.push(parseInt(filterMonth));
                }

                const mariaPlanQuery = `
                    SELECT f.CuenCtct, f.PeriInfo as PeriCtct, d.CuotDefa as BimeCtct, MAX(d.FeveDefa) as FeveCtct, 
                           SUM(d.TotaDefa - CASE WHEN d.FepaDefa IS NOT NULL THEN d.TotaDefa ELSE 0 END) as Capital,
                           SUM(d.TotaDefa) as DebeTotal,
                           SUM(CASE WHEN d.FepaDefa IS NOT NULL THEN d.TotaDefa ELSE 0 END) as Pagado
                    FROM ${DB_RECAUDACION}.facipago f
                    INNER JOIN ${DB_RECAUDACION}.detafapa d ON d.CodiFapa = f.CodiFapa
                    ${planWhere}
                    GROUP BY f.CuenCtct, f.PeriInfo, d.CuotDefa
                `;
                mariaPlans = await conn.query(mariaPlanQuery, planParams);
            }

            // 4. Fetch PostgreSQL Records in Bulk
            let pgWhere = "WHERE t.tpotribcod = $1 AND t.tbecod::text = ANY($2)";
            let pgParams = [officeId, cleanAccList];
            let pgParamCount = 3;
            if (filterYear) {
                pgWhere += ` AND gc.genctaancta = $${pgParamCount}`;
                pgParams.push(parseInt(filterYear));
                pgParamCount++;
            }
            if (filterMonth) {
                pgWhere += ` AND gc.genctanrocta = $${pgParamCount}`;
                pgParams.push(parseInt(filterMonth));
                pgParamCount++;
            }

            let pgDebtQuery;
            if (filterConcept) {
                const matches = getRawConceptMatches(filterConcept).map(m => m.toUpperCase().trim());
                const placeholders = matches.map((_, idx) => `$${pgParamCount + idx}`).join(',');
                pgWhere += ` AND UPPER(TRIM(BOTH ' ' FROM COALESCE(rt.rectrfdsc, tt.tpotribnom))) IN (${placeholders})`;
                pgParams.push(...matches);
                pgParamCount += matches.length;

                pgDebtQuery = `
                    SELECT t.tbecod::text as "CuenCtct", gc.genctaancta as "PeriCtct", gc.genctafchvto as "FeveCtct", 
                           COALESCE(gcd.genctadetimp, gc.genctaimpcta) as "DebeCtct",
                           (CASE WHEN (cc.cabpgoctactecod > 0) THEN COALESCE(gcd.genctadetimp, gc.genctaimpcta) ELSE 0 END) as "Pagado",
                           cc.ctactecod
                    FROM public.generacioncuota gc
                    LEFT JOIN public.generacioncuotadetalle gcd ON gc.genctacod = gcd.genctadetcod
                    LEFT JOIN public.recursostarifa rt ON rt.rectrfcod = gcd.genctadetreccod
                    LEFT JOIN public.cuentacorriente cc ON cc.genctacod = gc.genctacod
                    INNER JOIN public.tributo t ON gc.genctatribcod = t.tribcod
                    INNER JOIN public.tipotributo tt ON t.tpotribcod = tt.tpotribcod
                    ${pgWhere}
                `;
            } else {
                pgDebtQuery = `
                    SELECT t.tbecod::text as "CuenCtct", gc.genctaancta as "PeriCtct", gc.genctafchvto as "FeveCtct", gc.genctaimpcta as "DebeCtct",
                           (CASE WHEN (cc.cabpgoctactecod > 0) THEN gc.genctaimpcta ELSE 0 END) as "Pagado",
                           cc.ctactecod
                    FROM public.cuentacorriente cc
                    INNER JOIN public.generacioncuota gc ON cc.genctacod = gc.genctacod
                    INNER JOIN public.tributo t ON gc.genctatribcod = t.tribcod
                    ${pgWhere}
                `;
            }
            const pgResult = await postgresDB.query(pgDebtQuery, pgParams);
            pgRecords = pgResult.rows;
        }

        // Fetch Personal Info from vpadrones_persona in safe chunks of 1000
        const cleanAccListForPerson = [...new Set(accList.map(a => a.replace(/^0+/, '') || '0'))];
        for (let i = 0; i < cleanAccListForPerson.length; i += 1000) {
            const chunk = cleanAccListForPerson.slice(i, i + 1000);
            const placeholders = chunk.map(() => '?').join(',');
            const personDataRes = await conn.query(`
                SELECT nro_padron as CuenCtct, nro_doc as percod, denominacion as nombre, CUIT
                FROM ${DB_RECAUDACION}.vpadrones_persona
                WHERE nro_padron IN (${placeholders}) AND principal = 'SI'
            `, chunk);
            personDataRes.forEach(r => {
                const k = r.CuenCtct.toString().trim();
                personMap[k] = r;
            });
        }

        // 4b. Fetch Detailed Account Names (Trade name, etc.) in safe chunks of 1000
        let accountNameMap = {};
        if (accList.length > 0 && [7, 13, 2, 6, 3, 4].includes(offId)) {
            let nameQuery = "";
            if (offId === 7 || offId === 13) {
                nameQuery = "SELECT CodiCome as acc, RazoCome as name FROM antena WHERE CodiCome IN (";
            } else if (offId === 2) {
                nameQuery = "SELECT CodiCome as acc, RazoCome as name FROM comercio WHERE CodiCome IN (";
            } else if (offId === 6 || offId === 3) {
                nameQuery = "SELECT CodiCome as acc, RazoCome as name FROM publicidad WHERE CodiCome IN (";
            } else if (offId === 4) {
                nameQuery = "SELECT CodiCome as acc, RazoCome as name FROM cementerio WHERE CodiCome IN (";
            }

            for (let i = 0; i < accList.length; i += 1000) {
                const chunk = accList.slice(i, i + 1000);
                const placeholders = chunk.map(() => '?').join(',');
                try {
                    const nameResults = await conn.query(nameQuery + placeholders + ")", chunk);
                    nameResults.forEach(r => {
                        const k = r.acc.toString().trim();
                        accountNameMap[k] = r.name;
                        accountNameMap[k.replace(/^0+/, '') || '0'] = r.name;
                    });
                } catch (e) {
                    console.error("Error in bulk name lookup chunk:", e);
                }
            }
        }

        // 5. Calculate Summaries
        const today = new Date().toISOString().split('T')[0];

        // Create O(1) lookup maps to avoid O(N^2) matching
        const mdItemsMap = {};
        mariaRecords.forEach(r => {
            const mdAccClean = r.CuenCtct.toString().trim().replace(/^0+/, '') || '0';
            if (!mdItemsMap[mdAccClean]) mdItemsMap[mdAccClean] = [];
            mdItemsMap[mdAccClean].push(r);
        });

        const plItemsMap = {};
        mariaPlans.forEach(r => {
            const planAccClean = r.CuenCtct.toString().trim().replace(/^0+/, '') || '0';
            if (!plItemsMap[planAccClean]) plItemsMap[planAccClean] = [];
            plItemsMap[planAccClean].push(r);
        });

        const pgItemsMap = {};
        pgRecords.forEach(r => {
            const pgAccClean = r.CuenCtct.toString().trim().replace(/^0+/, '') || '0';
            if (!pgItemsMap[pgAccClean]) pgItemsMap[pgAccClean] = [];
            pgItemsMap[pgAccClean].push(r);
        });

        // Track Postgres paid codes to prevent double counting payments
        const payOnlyCtacteCods = new Set();
        pgRecords.forEach(row => {
            const dbVal = parseFloat(row.DebeCtct || 0);
            if (dbVal < 0 && row.ctactecod) {
                payOnlyCtacteCods.add(row.ctactecod.toString());
            }
        });

        const finalResults = accList.map(acc => {
            const cleanAcc = acc.replace(/^0+/, '') || '0';
            const pInfo = personMap[cleanAcc] || personMap[acc] || { percod: 'N/A', nombre: 'N/A', CUIT: 'N/A' };

            // MariaDB Calculation
            const mdItems = mdItemsMap[cleanAcc] || [];
            const plItems = plItemsMap[cleanAcc] || [];
            const allMdItems = [...mdItems, ...plItems];

            let mdPendiente = 0;
            let mdPagado = 0;
            let mdAnterior = 0;
            let mdTotalCapital = 0;

            allMdItems.forEach(r => {
                const capitalPendiente = parseFloat(r.Capital || 0);
                const pagado = parseFloat(r.Pagado || 0);
                const debeTotal = parseFloat(r.DebeTotal || 0);
                
                mdPagado += pagado;
                mdTotalCapital += debeTotal;

                if (capitalPendiente > 0.01) {
                    // Solo calculamos interés si NO está pagado (capitalPendiente > 0)
                    const reca = calculateLegacyInterest(r.FeveCtct, today, capitalPendiente);
                    const totalRow = capitalPendiente + reca;
                    mdPendiente += totalRow;
                    if (parseInt(r.PeriCtct) <= 2018) {
                        mdAnterior += totalRow;
                    }
                }
            });

            // Postgres Calculation
            const pgItems = pgItemsMap[cleanAcc] || [];
            let pgPendiente = 0;
            let pgPagado = 0;
            let pgAnterior = 0;
            let pgTotalCapital = 0;

            pgItems.forEach(r => {
                const amount = parseFloat(r.DebeCtct || 0);
                const hasSeparatePayments = r.ctactecod && payOnlyCtacteCods.has(r.ctactecod.toString());
                const isPaidByHeader = parseInt(r.Pagado || 0) > 0 && !hasSeparatePayments;
                
                let debe = 0;
                let haber = 0;

                if (amount < 0) {
                    haber = Math.abs(amount);
                } else {
                    debe = amount;
                    if (isPaidByHeader) {
                        haber = amount;
                    }
                }

                pgTotalCapital += debe;
                pgPagado += haber;

                // Si NO hay pago, calculamos deuda con interés dinámico
                const pending = Math.max(0, debe - haber);
                if (pending > 0.01) {
                    let reca = 0;
                    if (r.FeveCtct) {
                        reca = calculateLegacyInterest(r.FeveCtct, today, pending);
                    }
                    const totalRow = pending + reca;
                    pgPendiente += totalRow;
                    if (parseInt(r.PeriCtct) <= 2018) {
                        pgAnterior += totalRow;
                    }
                }
            });

            return {
                cuenta: acc,
                accountName: accountNameMap[cleanAcc] || accountNameMap[acc] || null,
                officeId: officeId,
                percod: pInfo.percod,
                nombre: pInfo.nombre,
                cuit: pInfo.CUIT,
                maria: {
                    total: mdTotalCapital,
                    pagado: mdPagado,
                    anterior: mdAnterior,
                    saldo: mdPendiente
                },
                postgres: {
                    total: pgTotalCapital,
                    pagado: pgPagado,
                    anterior: pgAnterior,
                    saldo: pgPendiente
                },
                diffDeuda: Math.abs(mdPendiente - pgPendiente),
                diffPagado: Math.abs(mdPagado - pgPagado),
                diffTotal: Math.abs(mdTotalCapital - pgTotalCapital)
            };
        });

        res.json({
            data: finalResults,
            total: isExport ? finalResults.length : 1000,
            page: parseInt(page),
            pageSize: isExport ? finalResults.length : parseInt(limit)
        });

    } catch (err) {
        console.error('Error in comparison report:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// Helper for offices
router.get('/offices', async (req, res) => {
    let conn;
    try {
        conn = await mariaDB.getRemoteConnection();
        const results = await conn.query(`SELECT CodiOfic as id, DetaOfic as name FROM ${DB_RECAUDACION}.oficina ORDER BY id`);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// Helper for concepts associated with an office
router.get('/concepts', async (req, res) => {
    const { officeId } = req.query;
    try {
        const rtRes = await postgresDB.query(`
            SELECT DISTINCT rectrfdsc as name 
            FROM public.recursostarifa 
            WHERE rectrfdsc IS NOT NULL AND rectrfdsc != ''
            ORDER BY name
        `);
        const ttRes = await postgresDB.query(`
            SELECT tpotribnom as name 
            FROM public.tipotributo 
            WHERE tpotribcod = $1
        `, [parseInt(officeId || 1)]);
        
        const rawConcepts = rtRes.rows.map(r => r.name.trim());
        if (ttRes.rows.length > 0) {
            rawConcepts.unshift(ttRes.rows[0].name.trim());
        }
        
        // Normalize all concepts and return sorted unique ones
        const normalized = rawConcepts.map(c => getNormalizedConceptName(c));
        res.json([...new Set(normalized)].sort());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// NEW: Fetch ticket history for a specific period/account to debug re-emissions
router.get('/tickets/:officeId/:account/:period/:bime', async (req, res) => {
    const { officeId, account, period, bime } = req.params;
    let conn;
    try {
        conn = await mariaDB.getRemoteConnection();
        
        // 1. First, find all ticket numbers AND their years associated with this exact debt in ctacte
        const ticketNumbersQuery = `
            SELECT DISTINCT NumeBole, PeriBole 
            FROM ${DB_NAME}.ctacte 
            WHERE CuenCtct = ? AND CodiOfic = ? AND PeriCtct = ? AND BimeCtct = ?
            AND NumeBole > 0
        `;
        const ticketRows = await conn.query(ticketNumbersQuery, [account, officeId, period, bime]);
        
        if (ticketRows.length === 0) {
            // Fallback: If no tickets in ctacte, try to find tickets emitted for this period directly
            const fallbackQuery = `
                SELECT b.*, b.CodiUsua as UserName
                FROM ${DB_RECAUDACION}.boleto b
                WHERE b.CodiOfic = ? AND b.CuenCtct = ? 
                AND b.PeriBole = ? AND b.NumeLiqu = ?
                ORDER BY b.AltaFeho ASC
            `;
            const fallbackResults = await conn.query(fallbackQuery, [officeId, account, period, bime]);
            return res.json(fallbackResults);
        }

        // Create a condition for pairs (NumeBole, PeriBole) to avoid bringing tickets from other years
        const conditions = ticketRows.map(r => `(b.NumeBole = ${r.NumeBole} AND b.PeriBole = ${r.PeriBole})`).join(' OR ');

        // 2. Fetch details for all those tickets, ensuring they belong to this account/office
        const detailsQuery = `
            SELECT b.*, b.CodiUsua as UserName
            FROM ${DB_RECAUDACION}.boleto b
            WHERE b.CodiOfic = ? AND b.CuenCtct = ?
            AND (${conditions})
            ORDER BY b.AltaFeho ASC
        `;
        const results = await conn.query(detailsQuery, [officeId, account]);
        res.json(results);
    } catch (err) {
        console.error("Error in /tickets:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

router.get('/pg-tickets/:account/:period/:bime', async (req, res) => {
    const { account, period, bime } = req.params;
    const postgresDB = require('../db/postgres');
    try {
        const query = `
            SELECT 
                cc.ctactecod, 
                gc.genctaancta as "PeriCtct", 
                gc.genctanrocta as "BimeCtct", 
                gc.genctaimpcta as "Importe",
                cc.cabpgoctactecod as "PagoId",
                cc.ctactefchalta as "Fecha",
                gc.genctacednro as "BoletoOriginal",
                bc.bolpgocod as "BoletoPago",
                bc.bolpgofecemi as "FechaEmisionBoleto",
                bc.bolpgoestado as "EstadoBoleto",
                p.pernom as "OwnerName",
                rt.rectrfdsc as "ConceptoNombre"
            FROM public.cuentacorriente cc
            INNER JOIN public.generacioncuota gc ON cc.genctacod = gc.genctacod
            INNER JOIN public.tributo t ON gc.genctatribcod = t.tribcod
            LEFT JOIN public.persona p ON gc.genctapercod = p.percod
            LEFT JOIN public.generacioncuotadetalle gcd ON gc.genctacod = gcd.genctadetcod
            LEFT JOIN public.recursostarifa rt ON rt.rectrfcod = gcd.genctadetreccod
            LEFT JOIN public.bolpgodet bd ON cc.ctactecod = bd.boldetctactecod
            LEFT JOIN public.bolpgocab bc ON (bd.bolpgocod = bc.bolpgocod AND bd.bolpgoeje = bc.bolpgoeje)
            WHERE t.tbecod = $1 
            AND gc.genctaancta = $2 
            AND gc.genctanrocta = $3
            ORDER BY cc.ctactefchalta ASC, bc.bolpgofecemi DESC
        `;
        const result = await postgresDB.query(query, [account, period, bime]);
        res.json(result.rows);
    } catch (err) {
        console.error("Error in /pg-tickets:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
