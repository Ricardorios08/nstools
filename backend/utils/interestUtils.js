const CUTOFF_NEW = new Date('2014-07-01');
const CUTOFF_HIKE = new Date('2024-05-06');
const RATE_BASE = 3.0; // % monthly
const RATE_HIKE = 8.0; // % monthly

const dailyRate3 = Math.pow(1 + (RATE_BASE / 100), 1 / 30) - 1;
const dailyRate8 = Math.pow(1 + (RATE_HIKE / 100), 1 / 30) - 1;

function calculateLegacyInterest(dueDate, queryDate, capital) {
    if (capital <= 0 || !dueDate) return 0;
    
    const dDate = new Date(dueDate);
    const qDate = new Date(queryDate);
    
    if (isNaN(dDate.getTime()) || isNaN(qDate.getTime())) return 0;
    if (qDate <= dDate) return 0;

    let totalInterest = 0;

    if (dDate >= CUTOFF_NEW) {
        if (qDate < CUTOFF_HIKE) {
            const days = Math.ceil((qDate - dDate) / (1000 * 60 * 60 * 24));
            totalInterest = capital * days * dailyRate3;
        } else if (dDate >= CUTOFF_HIKE) {
            const days = Math.ceil((qDate - dDate) / (1000 * 60 * 60 * 24));
            totalInterest = capital * days * dailyRate8;
        } else {
            const days3 = Math.ceil((new Date('2024-05-05') - dDate) / (1000 * 60 * 60 * 24));
            const days8 = Math.ceil((qDate - CUTOFF_HIKE) / (1000 * 60 * 60 * 24)) + 1;
            totalInterest = (capital * days3 * dailyRate3) + (capital * days8 * dailyRate8);
        }
    } else {
        let vInteres = 1.0;
        let pI = new Date(dDate);
        const pF = new Date(queryDate);

        const applySegment = (startDate, endDate, dailyFactor, isCompound) => {
            if (pI < endDate && pF > startDate) {
                const start = pI > startDate ? pI : startDate;
                const end = pF < endDate ? pF : endDate;
                const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
                if (days > 0) {
                    if (isCompound) {
                        vInteres *= Math.pow(1 + dailyFactor, days);
                    } else {
                        vInteres += (dailyFactor * days);
                    }
                    pI = new Date(end.getTime() + 86400000);
                }
            }
        };

        applySegment(new Date('1992-01-01'), new Date('1992-10-31'), 0.0018, true);
        applySegment(new Date('1992-11-01'), new Date('1995-06-30'), 0.0013, true);
        applySegment(new Date('1995-07-01'), new Date('1997-10-31'), 0.000966, false);
        applySegment(new Date('1997-11-01'), new Date('1999-12-31'), 0.000600, false);
        applySegment(new Date('2000-01-01'), new Date('2001-10-28'), 0.000476, false);
        applySegment(new Date('2001-10-29'), new Date('2002-05-26'), 0.000317, false);
        applySegment(new Date('2002-05-27'), new Date('2004-10-31'), 0.000845, false);
        applySegment(new Date('2004-11-01'), new Date('2005-12-31'), 0.000524, false);
        applySegment(new Date('2006-01-01'), new Date('2009-09-14'), 0.000516, false);
        applySegment(new Date('2009-09-15'), new Date('2014-06-30'), 0.000500, false);

        totalInterest = capital * (vInteres - 1);

        if (pF >= CUTOFF_NEW) {
            const startForModern = pI > CUTOFF_NEW ? pI : CUTOFF_NEW;
            if (pF < CUTOFF_HIKE) {
                const days = Math.ceil((pF - startForModern) / (1000 * 60 * 60 * 24));
                totalInterest += capital * days * dailyRate3;
            } else {
                const days3 = Math.ceil((new Date('2024-05-05') - startForModern) / (1000 * 60 * 60 * 24));
                const days8 = Math.ceil((pF - CUTOFF_HIKE) / (1000 * 60 * 60 * 24)) + 1;
                totalInterest += (capital * days3 * dailyRate3) + (capital * (days8 > 0 ? days8 : 0) * dailyRate8);
            }
        }
    }

    return Math.round(totalInterest * 100) / 100;
}

module.exports = {
    calculateLegacyInterest
};
