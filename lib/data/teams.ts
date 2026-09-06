import raw from "./teams.json";

export interface SeedTeam {
  name: string;
  conf: string;
  div: string;
  score: number;
}

// The 72 fixed programs + their fixed historical-strength input, pulled
// verbatim from the workbook's `TeamPlan` sheet.
export const SEED_TEAMS: SeedTeam[] = raw as SeedTeam[];

export const CONFERENCE_NAMES: Record<string, string> = {
  SEC: "SEC",
  B10: "Big Ten",
  B12: "Big 12",
  PAC: "Pac-12",
  ACC: "ACC",
  BEC: "BEC",
};

export const DIVISION_NAMES: Record<string, string> = {
  SECE: "SEC East",
  SECW: "SEC West",
  B10E: "Big Ten East",
  B10W: "Big Ten West",
  B12N: "Big 12 North",
  B12S: "Big 12 South",
  PACN: "Pac-12 North",
  PACS: "Pac-12 South",
  ACCA: "ACC Atlantic",
  ACCC: "ACC Coastal",
  BECA: "BEC Alpha",
  BECM: "BEC Metro",
};
