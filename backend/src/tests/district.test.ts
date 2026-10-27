import { describe, it, expect } from 'vitest';
import { DistrictBoundaryService } from '../services/district.service.js';

describe('DistrictBoundaryService Point-in-Polygon Tests', () => {
  const service = new DistrictBoundaryService();

  it('resolves known coordinate in Mumbai to MUMBAI or MUMBAI SUBURBAN in MAHARASHTRA', () => {
    // 19.076, 72.8777 (Mumbai Metro)
    const result = service.findDistrictByCoordinates(19.076, 72.8777);
    expect(result).not.toBeNull();
    expect(result?.matchStatus).toBe('RESOLVED_DISTRICT');
    expect(result?.canonicalState).toBe('MAHARASHTRA');
    expect(['MUMBAI', 'MUMBAI SUBURBAN']).toContain(result?.canonicalDistrict);
    expect(result?.datasetSource).toContain('DataMeet');
    expect(result?.vintage).toContain('2011');
  });

  it('resolves known coordinate in Guwahati to KAMRUP METROPOLITAN in ASSAM', () => {
    // 26.1445, 91.7362 (Guwahati)
    const result = service.findDistrictByCoordinates(26.1445, 91.7362);
    expect(result).not.toBeNull();
    expect(result?.matchStatus).toBe('RESOLVED_DISTRICT');
    expect(result?.canonicalDistrict).toBe('KAMRUP METROPOLITAN');
    expect(result?.canonicalState).toBe('ASSAM');
  });

  it('resolves known coordinate in Dehradun to DEHRADUN in UTTARAKHAND', () => {
    // 30.3165, 78.0322 (Dehradun)
    const result = service.findDistrictByCoordinates(30.3165, 78.0322);
    expect(result).not.toBeNull();
    expect(result?.matchStatus).toBe('RESOLVED_DISTRICT');
    expect(result?.canonicalDistrict).toBe('DEHRADUN');
    expect(result?.canonicalState).toBe('UTTARAKHAND');
  });

  it('resolves known coordinate in Chennai to CHENNAI in TAMIL NADU', () => {
    // 13.0827, 80.2707 (Chennai)
    const result = service.findDistrictByCoordinates(13.0827, 80.2707);
    expect(result).not.toBeNull();
    expect(result?.matchStatus).toBe('RESOLVED_DISTRICT');
    expect(result?.canonicalDistrict).toBe('CHENNAI');
    expect(result?.canonicalState).toBe('TAMIL NADU');
  });

  it('returns OFFSHORE_OR_UNRESOLVED for points in the Arabian Sea or outside India', () => {
    // Arabian Sea (19.0, 70.0)
    const seaResult = service.findDistrictByCoordinates(19.0, 70.0);
    expect(seaResult).not.toBeNull();
    expect(seaResult?.matchStatus).toBe('OFFSHORE_OR_UNRESOLVED');
    expect(seaResult?.canonicalDistrict).toBeNull();
    expect(seaResult?.coverageNotice).toContain('outside covered Indian administrative district');

    // Indian Ocean south of India (5.0, 80.0)
    const oceanResult = service.findDistrictByCoordinates(5.0, 80.0);
    expect(oceanResult?.matchStatus).toBe('OFFSHORE_OR_UNRESOLVED');
  });

  it('rejects invalid, NaN, or out-of-range coordinates cleanly', () => {
    expect(service.findDistrictByCoordinates(NaN, 72.8)).toBeNull();
    expect(service.findDistrictByCoordinates(19.0, NaN)).toBeNull();
    expect(service.findDistrictByCoordinates(95.0, 72.0)).toBeNull(); // lat > 90
    expect(service.findDistrictByCoordinates(19.0, 200.0)).toBeNull(); // lon > 180
  });

  it('normalizes IMD bulletin titles using synonym mappings', () => {
    const normMuzaffarpur = service.normalizeImdDistrictName('MUZAFFARPUR DISTRICT');
    expect(normMuzaffarpur.normalizedDistrict).toBe('MUZAFFARPUR');

    const normBangalore = service.normalizeImdDistrictName('BANGALORE URBAN DISTRICT');
    expect(normBangalore.normalizedDistrict).toBe('BANGALORE');

    const normHowrah = service.normalizeImdDistrictName('HOWRAH');
    expect(normHowrah.normalizedDistrict).toBe('HAORA');
  });

  // Fix 1: Raigad Normalization & Regression Test
  it('Fix 1: normalizes RAIGAD to canonical RAIGARH in MAHARASHTRA and matches Alibag coordinates', () => {
    // Alibag coordinates in Raigad district: 18.6414 N, 72.8722 E
    const alibagResult = service.findDistrictByCoordinates(18.6414, 72.8722);
    expect(alibagResult).not.toBeNull();
    expect(alibagResult?.matchStatus).toBe('RESOLVED_DISTRICT');
    expect(alibagResult?.canonicalDistrict).toBe('RAIGARH');
    expect(alibagResult?.canonicalState).toBe('MAHARASHTRA');

    // Normalization check
    const normRaigad = service.normalizeImdDistrictName('RAIGAD');
    expect(normRaigad.normalizedDistrict).toBe('RAIGARH');
    expect(normRaigad.normalizedState).toBe('MAHARASHTRA');
    expect(normRaigad.isRecognized).toBe(true);

    const normRaigadDist = service.normalizeImdDistrictName('RAIGAD DISTRICT');
    expect(normRaigadDist.normalizedDistrict).toBe('RAIGARH');
    expect(normRaigadDist.normalizedState).toBe('MAHARASHTRA');

    // Bulletin matching for Maharashtra's Raigarh (Raigad)
    expect(service.isBulletinMatch('RAIGAD', 'RAIGARH', 'MAHARASHTRA')).toBe(true);
    expect(service.isBulletinMatch('RAIGAD DISTRICT', 'RAIGARH', 'MAHARASHTRA')).toBe(true);

    // Cross-state protection: RAIGAD bulletin must NOT match Chhattisgarh's Raigarh
    expect(service.isBulletinMatch('RAIGAD', 'RAIGARH', 'CHHATTISGARH')).toBe(false);
  });

  // Fix 3: Cross-State Homonym Disambiguation
  it('Fix 3: prevents false matches for homonymous districts without state context', () => {
    // Unqualified homonyms lacking state context must reject to avoid false positive attribution
    expect(service.isBulletinMatch('BILASPUR', 'BILASPUR', 'HIMACHAL PRADESH')).toBe(false);
    expect(service.isBulletinMatch('BILASPUR', 'BILASPUR', 'CHHATTISGARH')).toBe(false);
    expect(service.isBulletinMatch('AURANGABAD', 'AURANGABAD', 'BIHAR')).toBe(false);
    expect(service.isBulletinMatch('AURANGABAD', 'AURANGABAD', 'MAHARASHTRA')).toBe(false);
    expect(service.isBulletinMatch('HAMIRPUR', 'HAMIRPUR', 'HIMACHAL PRADESH')).toBe(false);
    expect(service.isBulletinMatch('PRATAPGARH', 'PRATAPGARH', 'UTTAR PRADESH')).toBe(false);

    // Bulletins with explicit state context match their respective state only
    expect(service.isBulletinMatch('BILASPUR (HP)', 'BILASPUR', 'HIMACHAL PRADESH')).toBe(true);
    expect(service.isBulletinMatch('BILASPUR (HP)', 'BILASPUR', 'CHHATTISGARH')).toBe(false);
    expect(service.isBulletinMatch('BILASPUR (CG)', 'BILASPUR', 'CHHATTISGARH')).toBe(true);
    expect(service.isBulletinMatch('BILASPUR (CG)', 'BILASPUR', 'HIMACHAL PRADESH')).toBe(false);

    expect(service.isBulletinMatch('AURANGABAD (BIHAR)', 'AURANGABAD', 'BIHAR')).toBe(true);
    expect(service.isBulletinMatch('AURANGABAD (BIHAR)', 'AURANGABAD', 'MAHARASHTRA')).toBe(false);
    expect(service.isBulletinMatch('AURANGABAD (MAHARASHTRA)', 'AURANGABAD', 'MAHARASHTRA')).toBe(true);

    expect(service.isBulletinMatch('HAMIRPUR (HP)', 'HAMIRPUR', 'HIMACHAL PRADESH')).toBe(true);
    expect(service.isBulletinMatch('HAMIRPUR (HP)', 'HAMIRPUR', 'UTTAR PRADESH')).toBe(false);

    expect(service.isBulletinMatch('PRATAPGARH (UP)', 'PRATAPGARH', 'UTTAR PRADESH')).toBe(true);
    expect(service.isBulletinMatch('PRATAPGARH (UP)', 'PRATAPGARH', 'RAJASTHAN')).toBe(false);
  });

  // Fix 4: Boundary Ambiguity Resolution
  it('Fix 4: flags boundary ambiguity when coordinates fall on shared border vertices', () => {
    // Panchkula (Haryana) & Sirmaur (HP) border vertex at [77.1252, 30.5633]
    const borderResult = service.findDistrictByCoordinates(30.5633, 77.1252);
    expect(borderResult).not.toBeNull();
    expect(borderResult?.matchStatus).toBe('RESOLVED_DISTRICT');
    expect(borderResult?.isAmbiguous).toBe(true);
    expect(borderResult?.secondaryDistricts).toBeDefined();
    expect(borderResult?.secondaryDistricts?.length).toBeGreaterThan(0);
    expect(borderResult?.coverageNotice).toContain('boundary overlap or border zone');

    // Unambiguous interior point should have isAmbiguous === false
    const clearResult = service.findDistrictByCoordinates(19.076, 72.8777); // Mumbai
    expect(clearResult?.isAmbiguous).toBe(false);
    expect(clearResult?.secondaryDistricts).toBeUndefined();
  });

  it('matches bulletins to canonical districts accurately without unsafe substring clashes', () => {
    // Exact match for non-homonymous district
    expect(service.isBulletinMatch('DEHRADUN', 'DEHRADUN', 'UTTARAKHAND')).toBe(true);

    // Synonym match
    expect(service.isBulletinMatch('BANGALORE URBAN', 'BANGALORE', 'KARNATAKA')).toBe(true);
    expect(service.isBulletinMatch('HAORA', 'HOWRAH', 'WEST BENGAL')).toBe(true);
  });
});
