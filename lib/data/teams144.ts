// The 144 fixed programs for the MEGA144 ruleset (12 conferences, 2
// divisions x 6 teams each), transcribed verbatim from the user's table.
// `prestige` is the team's starting Prestige, given directly (unlike the
// CLASSIC roster's `historicScore`, this needs no scaling transform).

export interface SeedTeam144 {
  name: string; // abbreviation, used as the unique display name (matches CLASSIC convention)
  fullName: string;
  mascot: string;
  conf: string;
  div: string;
  prestige: number;
  // This team's letter (A-L, stored as 0-11) within its conference's
  // rivalry order -- NOT reset per division: the first-listed division's 6
  // teams are 0-5 (A-F), the second's are 6-11 (G-L). Assigned from the
  // RIVALRY PAIRS the user gave (each pair -> one adjacent even/odd slot,
  // e.g. 0-1, 2-3, ...), not from the plain division roster listing above
  // them -- the two orders don't always match (e.g. Big Ten West is listed
  // "Illinois, Iowa, Iowa State, Minnesota, Northwestern, Wisconsin" but the
  // actual rivalries are Iowa/Iowa State, Minnesota/Wisconsin,
  // Illinois/Northwestern). Drives lib/sim/schedule144.ts's
  // C_TABLE/D_TABLE lookups and the fixed DR rivalry pairing (always
  // consecutive slots: 0-1, 2-3, 4-5, 6-7, 8-9, 10-11).
  rivalrySlot: number;
}

export const SEED_TEAMS_144: SeedTeam144[] = [
  // SEC West: Alabama/Auburn (Iron Bowl), Arkansas/LSU (Golden Boot), Ole Miss/Mississippi State (Egg Bowl)
  { name: "ALA", fullName: "Alabama", mascot: "Crimson Tide", conf: "SEC", div: "SECW", prestige: 27, rivalrySlot: 0 },
  { name: "AUB", fullName: "Auburn", mascot: "Tigers", conf: "SEC", div: "SECW", prestige: 19, rivalrySlot: 1 },
  { name: "ARK", fullName: "Arkansas", mascot: "Razorbacks", conf: "SEC", div: "SECW", prestige: 10, rivalrySlot: 2 },
  { name: "LSU", fullName: "LSU", mascot: "Tigers", conf: "SEC", div: "SECW", prestige: 20, rivalrySlot: 3 },
  { name: "MISS", fullName: "Ole Miss", mascot: "Rebels", conf: "SEC", div: "SECW", prestige: 10, rivalrySlot: 4 },
  { name: "MSST", fullName: "Mississippi State", mascot: "Bulldogs", conf: "SEC", div: "SECW", prestige: 4, rivalrySlot: 5 },
  // SEC East: Florida/Georgia (World's Largest Outdoor Cocktail Party), Tennessee/Vanderbilt, Kentucky/South Carolina
  { name: "FLA", fullName: "Florida", mascot: "Gators", conf: "SEC", div: "SECE", prestige: 22, rivalrySlot: 6 },
  { name: "UGA", fullName: "Georgia", mascot: "Bulldogs", conf: "SEC", div: "SECE", prestige: 23, rivalrySlot: 7 },
  { name: "TENN", fullName: "Tennessee", mascot: "Volunteers", conf: "SEC", div: "SECE", prestige: 19, rivalrySlot: 8 },
  { name: "VAN", fullName: "Vanderbilt", mascot: "Commodores", conf: "SEC", div: "SECE", prestige: -9, rivalrySlot: 9 },
  { name: "UK", fullName: "Kentucky", mascot: "Wildcats", conf: "SEC", div: "SECE", prestige: 4, rivalrySlot: 10 },
  { name: "SC", fullName: "South Carolina", mascot: "Gamecocks", conf: "SEC", div: "SECE", prestige: 8, rivalrySlot: 11 },

  // Big Ten West: Iowa/Iowa State (Cy-Hawk), Minnesota/Wisconsin (Paul Bunyan's Axe), Illinois/Northwestern (Land of Lincoln)
  { name: "IOWA", fullName: "Iowa", mascot: "Hawkeyes", conf: "B1G", div: "B1GW", prestige: 15, rivalrySlot: 0 },
  { name: "ISU", fullName: "Iowa State", mascot: "Cyclones", conf: "B1G", div: "B1GW", prestige: 1, rivalrySlot: 1 },
  { name: "MINN", fullName: "Minnesota", mascot: "Golden Gophers", conf: "B1G", div: "B1GW", prestige: 3, rivalrySlot: 2 },
  { name: "WIS", fullName: "Wisconsin", mascot: "Badgers", conf: "B1G", div: "B1GW", prestige: 15, rivalrySlot: 3 },
  { name: "ILL", fullName: "Illinois", mascot: "Fighting Illini", conf: "B1G", div: "B1GW", prestige: 2, rivalrySlot: 4 },
  { name: "NU", fullName: "Northwestern", mascot: "Wildcats", conf: "B1G", div: "B1GW", prestige: 0, rivalrySlot: 5 },
  // Big Ten East: Michigan/Ohio State (The Game), Indiana/Purdue (Old Oaken Bucket), Michigan State/Penn State (Land Grant)
  { name: "MICH", fullName: "Michigan", mascot: "Wolverines", conf: "B1G", div: "B1GE", prestige: 22, rivalrySlot: 6 },
  { name: "OSU", fullName: "Ohio State", mascot: "Buckeyes", conf: "B1G", div: "B1GE", prestige: 27, rivalrySlot: 7 },
  { name: "IU", fullName: "Indiana", mascot: "Hoosiers", conf: "B1G", div: "B1GE", prestige: -4, rivalrySlot: 8 },
  { name: "PUR", fullName: "Purdue", mascot: "Boilermakers", conf: "B1G", div: "B1GE", prestige: 1, rivalrySlot: 9 },
  { name: "MSU", fullName: "Michigan State", mascot: "Spartans", conf: "B1G", div: "B1GE", prestige: 9, rivalrySlot: 10 },
  { name: "PSU", fullName: "Penn State", mascot: "Nittany Lions", conf: "B1G", div: "B1GE", prestige: 21, rivalrySlot: 11 },

  // Pac-12 South: Arizona/Arizona State (Territorial Cup), USC/UCLA, Utah/BYU (Holy War)
  { name: "ARIZ", fullName: "Arizona", mascot: "Wildcats", conf: "P12", div: "P12S", prestige: 8, rivalrySlot: 0 },
  { name: "ASU", fullName: "Arizona State", mascot: "Sun Devils", conf: "P12", div: "P12S", prestige: 5, rivalrySlot: 1 },
  { name: "USC", fullName: "USC", mascot: "Trojans", conf: "P12", div: "P12S", prestige: 20, rivalrySlot: 2 },
  { name: "UCLA", fullName: "UCLA", mascot: "Bruins", conf: "P12", div: "P12S", prestige: 12, rivalrySlot: 3 },
  { name: "UTAH", fullName: "Utah", mascot: "Utes", conf: "P12", div: "P12S", prestige: 12, rivalrySlot: 4 },
  { name: "BYU", fullName: "BYU", mascot: "Cougars", conf: "P12", div: "P12S", prestige: 9, rivalrySlot: 5 },
  // Pac-12 North: California/Stanford (Big Game), Oregon/Oregon State (Civil War), Washington/Washington State (Apple Cup)
  { name: "CAL", fullName: "California", mascot: "Golden Bears", conf: "P12", div: "P12N", prestige: 4, rivalrySlot: 6 },
  { name: "STAN", fullName: "Stanford", mascot: "Cardinal", conf: "P12", div: "P12N", prestige: 7, rivalrySlot: 7 },
  { name: "ORE", fullName: "Oregon", mascot: "Ducks", conf: "P12", div: "P12N", prestige: 19, rivalrySlot: 8 },
  { name: "ORST", fullName: "Oregon State", mascot: "Beavers", conf: "P12", div: "P12N", prestige: 2, rivalrySlot: 9 },
  { name: "WASH", fullName: "Washington", mascot: "Huskies", conf: "P12", div: "P12N", prestige: 14, rivalrySlot: 10 },
  { name: "WSU", fullName: "Washington State", mascot: "Cougars", conf: "P12", div: "P12N", prestige: 4, rivalrySlot: 11 },

  // ACC Atlantic: Florida State/Miami, NC State/Wake Forest, Clemson/Notre Dame (weak pairing)
  { name: "FSU", fullName: "Florida State", mascot: "Seminoles", conf: "ACC", div: "ACCA", prestige: 25, rivalrySlot: 0 },
  { name: "MIA", fullName: "Miami", mascot: "Hurricanes", conf: "ACC", div: "ACCA", prestige: 22, rivalrySlot: 1 },
  { name: "NCSU", fullName: "NC State", mascot: "Wolfpack", conf: "ACC", div: "ACCA", prestige: 9, rivalrySlot: 2 },
  { name: "WAKE", fullName: "Wake Forest", mascot: "Demon Deacons", conf: "ACC", div: "ACCA", prestige: -1, rivalrySlot: 3 },
  { name: "CLEM", fullName: "Clemson", mascot: "Tigers", conf: "ACC", div: "ACCA", prestige: 21, rivalrySlot: 4 },
  { name: "ND", fullName: "Notre Dame", mascot: "Fighting Irish", conf: "ACC", div: "ACCA", prestige: 20, rivalrySlot: 5 },
  // ACC Coastal: Virginia/Virginia Tech (Commonwealth Cup), Duke/North Carolina (Tobacco Road), Georgia Tech/Maryland (weak pairing)
  { name: "UVA", fullName: "Virginia", mascot: "Cavaliers", conf: "ACC", div: "ACCC", prestige: 5, rivalrySlot: 6 },
  { name: "VT", fullName: "Virginia Tech", mascot: "Hokies", conf: "ACC", div: "ACCC", prestige: 15, rivalrySlot: 7 },
  { name: "DUKE", fullName: "Duke", mascot: "Blue Devils", conf: "ACC", div: "ACCC", prestige: -3, rivalrySlot: 8 },
  { name: "UNC", fullName: "North Carolina", mascot: "Tar Heels", conf: "ACC", div: "ACCC", prestige: 8, rivalrySlot: 9 },
  { name: "GT", fullName: "Georgia Tech", mascot: "Yellow Jackets", conf: "ACC", div: "ACCC", prestige: 8, rivalrySlot: 10 },
  { name: "MD", fullName: "Maryland", mascot: "Terrapins", conf: "ACC", div: "ACCC", prestige: 5, rivalrySlot: 11 },

  // Big 12 South: Texas/Texas A&M (Lone Star Showdown), Oklahoma/Oklahoma State (Bedlam), Baylor/Texas Tech
  { name: "TEX", fullName: "Texas", mascot: "Longhorns", conf: "B12", div: "B12S", prestige: 20, rivalrySlot: 0 },
  { name: "TA&M", fullName: "Texas A&M", mascot: "Aggies", conf: "B12", div: "B12S", prestige: 16, rivalrySlot: 1 },
  { name: "OU", fullName: "Oklahoma", mascot: "Sooners", conf: "B12", div: "B12S", prestige: 24, rivalrySlot: 2 },
  { name: "OKST", fullName: "Oklahoma State", mascot: "Cowboys", conf: "B12", div: "B12S", prestige: 13, rivalrySlot: 3 },
  { name: "BAY", fullName: "Baylor", mascot: "Bears", conf: "B12", div: "B12S", prestige: 6, rivalrySlot: 4 },
  { name: "TTU", fullName: "Texas Tech", mascot: "Red Raiders", conf: "B12", div: "B12S", prestige: 7, rivalrySlot: 5 },
  // Big 12 North: Kansas/Kansas State (Sunflower Showdown), Nebraska/Missouri (Border War), Colorado/TCU (weak pairing)
  { name: "KU", fullName: "Kansas", mascot: "Jayhawks", conf: "B12", div: "B12N", prestige: -1, rivalrySlot: 6 },
  { name: "KSU", fullName: "Kansas State", mascot: "Wildcats", conf: "B12", div: "B12N", prestige: 13, rivalrySlot: 7 },
  { name: "NEB", fullName: "Nebraska", mascot: "Cornhuskers", conf: "B12", div: "B12N", prestige: 19, rivalrySlot: 8 },
  { name: "MIZ", fullName: "Missouri", mascot: "Tigers", conf: "B12", div: "B12N", prestige: 8, rivalrySlot: 9 },
  { name: "COLO", fullName: "Colorado", mascot: "Buffaloes", conf: "B12", div: "B12N", prestige: 8, rivalrySlot: 10 },
  { name: "TCU", fullName: "TCU", mascot: "Horned Frogs", conf: "B12", div: "B12N", prestige: 11, rivalrySlot: 11 },

  // BEC East: UCF/South Florida (War on I-4), Syracuse/Boston College, Rutgers/Temple
  { name: "UCF", fullName: "Central Florida", mascot: "Knights", conf: "BEC", div: "BECE", prestige: 3, rivalrySlot: 0 },
  { name: "USF", fullName: "South Florida", mascot: "Bulls", conf: "BEC", div: "BECE", prestige: -4, rivalrySlot: 1 },
  { name: "SYR", fullName: "Syracuse", mascot: "Orange", conf: "BEC", div: "BECE", prestige: 6, rivalrySlot: 2 },
  { name: "BC", fullName: "Boston College", mascot: "Eagles", conf: "BEC", div: "BECE", prestige: 5, rivalrySlot: 3 },
  { name: "RUTG", fullName: "Rutgers", mascot: "Scarlet Knights", conf: "BEC", div: "BECE", prestige: -1, rivalrySlot: 4 },
  { name: "TEM", fullName: "Temple", mascot: "Owls", conf: "BEC", div: "BECE", prestige: -16, rivalrySlot: 5 },
  // BEC West: Army/Navy, Pittsburgh/West Virginia (Backyard Brawl), Louisville/Cincinnati (Keg of Nails)
  { name: "ARMY", fullName: "Army", mascot: "Black Knights", conf: "BEC", div: "BECW", prestige: -8, rivalrySlot: 6 },
  { name: "NAVY", fullName: "Navy", mascot: "Midshipmen", conf: "BEC", div: "BECW", prestige: -7, rivalrySlot: 7 },
  { name: "PITT", fullName: "Pittsburgh", mascot: "Panthers", conf: "BEC", div: "BECW", prestige: 5, rivalrySlot: 8 },
  { name: "WVU", fullName: "West Virginia", mascot: "Mountaineers", conf: "BEC", div: "BECW", prestige: 13, rivalrySlot: 9 },
  { name: "LOU", fullName: "Louisville", mascot: "Cardinals", conf: "BEC", div: "BECW", prestige: 9, rivalrySlot: 10 },
  { name: "CIN", fullName: "Cincinnati", mascot: "Bearcats", conf: "BEC", div: "BECW", prestige: 4, rivalrySlot: 11 },

  // Sun Belt East: Louisiana/Louisiana-Monroe, Troy/South Alabama (Battle for the Belt), Georgia State/Georgia Southern
  { name: "UL", fullName: "Louisiana", mascot: "Ragin' Cajuns", conf: "SBT", div: "SBTE", prestige: -4, rivalrySlot: 0 },
  { name: "ULM", fullName: "Louisiana-Monroe", mascot: "Indians", conf: "SBT", div: "SBTE", prestige: -23, rivalrySlot: 1 },
  { name: "TROY", fullName: "Troy", mascot: "Trojans", conf: "SBT", div: "SBTE", prestige: -3, rivalrySlot: 2 },
  { name: "USA", fullName: "South Alabama", mascot: "Jaguars", conf: "SBT", div: "SBTE", prestige: -11, rivalrySlot: 3 },
  { name: "GAST", fullName: "Georgia State", mascot: "Panthers", conf: "SBT", div: "SBTE", prestige: -14, rivalrySlot: 4 },
  { name: "GASO", fullName: "Georgia Southern", mascot: "Eagles", conf: "SBT", div: "SBTE", prestige: -9, rivalrySlot: 5 },
  // Sun Belt West: UAB/Southern Mississippi, Arkansas State/Louisiana Tech, Middle Tennessee/Western Kentucky
  { name: "UAB", fullName: "UAB", mascot: "Blazers", conf: "SBT", div: "SBTW", prestige: -10, rivalrySlot: 6 },
  { name: "USM", fullName: "Southern Mississippi", mascot: "Eagles", conf: "SBT", div: "SBTW", prestige: -6, rivalrySlot: 7 },
  { name: "ARST", fullName: "Arkansas State", mascot: "Red Wolves", conf: "SBT", div: "SBTW", prestige: -11, rivalrySlot: 8 },
  { name: "LT", fullName: "Louisiana Tech", mascot: "Bulldogs", conf: "SBT", div: "SBTW", prestige: -10, rivalrySlot: 9 },
  { name: "MTSU", fullName: "M. Tennessee St", mascot: "Blue Raiders", conf: "SBT", div: "SBTW", prestige: -12, rivalrySlot: 10 },
  { name: "WKU", fullName: "Western Kentucky", mascot: "Hilltoppers", conf: "SBT", div: "SBTW", prestige: -6, rivalrySlot: 11 },

  // MAC East: Miami (Ohio)/Ohio (Battle of the Bricks), Akron/Kent State (Wagon Wheel), Ball State/Buffalo (weak pairing)
  { name: "M-OH", fullName: "Miami (Ohio)", mascot: "RedHawks", conf: "MAC", div: "MACE", prestige: -1, rivalrySlot: 0 },
  { name: "OHIO", fullName: "Ohio", mascot: "Bobcats", conf: "MAC", div: "MACE", prestige: -9, rivalrySlot: 1 },
  { name: "AKR", fullName: "Akron", mascot: "Zips", conf: "MAC", div: "MACE", prestige: -20, rivalrySlot: 2 },
  { name: "KENT", fullName: "Kent State", mascot: "Golden Flashes", conf: "MAC", div: "MACE", prestige: -21, rivalrySlot: 3 },
  { name: "BALL", fullName: "Ball State", mascot: "Cardinals", conf: "MAC", div: "MACE", prestige: -11, rivalrySlot: 4 },
  { name: "BUFF", fullName: "Buffalo", mascot: "Bulls", conf: "MAC", div: "MACE", prestige: -19, rivalrySlot: 5 },
  // MAC West: Toledo/Bowling Green (Battle of I-75), Central Michigan/Western Michigan (Victory Cannon), Eastern Michigan/Northern Illinois (weak pairing)
  { name: "TOL", fullName: "Toledo", mascot: "Rockets", conf: "MAC", div: "MACW", prestige: 2, rivalrySlot: 6 },
  { name: "BGSU", fullName: "Bowling Green", mascot: "Falcons", conf: "MAC", div: "MACW", prestige: -3, rivalrySlot: 7 },
  { name: "CMU", fullName: "Central Michigan", mascot: "Chippewas", conf: "MAC", div: "MACW", prestige: -8, rivalrySlot: 8 },
  { name: "WMU", fullName: "Western Michigan", mascot: "Broncos", conf: "MAC", div: "MACW", prestige: -6, rivalrySlot: 9 },
  { name: "EMU", fullName: "Eastern Michigan", mascot: "Eagles", conf: "MAC", div: "MACW", prestige: -16, rivalrySlot: 10 },
  { name: "NIU", fullName: "Northern Illinois", mascot: "Huskies", conf: "MAC", div: "MACW", prestige: -3, rivalrySlot: 11 },

  // MWC Mountain: Air Force/Colorado State (Ram-Falcon Trophy), Wyoming/Boise State, New Mexico/Utah State (weak pairing)
  { name: "AFA", fullName: "Air Force", mascot: "Falcons", conf: "MWC", div: "MWCM", prestige: 2, rivalrySlot: 0 },
  { name: "CSU", fullName: "Colorado State", mascot: "Rams", conf: "MWC", div: "MWCM", prestige: -5, rivalrySlot: 1 },
  { name: "WYO", fullName: "Wyoming", mascot: "Cowboys", conf: "MWC", div: "MWCM", prestige: -4, rivalrySlot: 2 },
  { name: "BOIS", fullName: "Boise State", mascot: "Broncos", conf: "MWC", div: "MWCM", prestige: 12, rivalrySlot: 3 },
  { name: "UNM", fullName: "New Mexico", mascot: "Lobos", conf: "MWC", div: "MWCM", prestige: -17, rivalrySlot: 4 },
  { name: "USU", fullName: "Utah State", mascot: "Aggies", conf: "MWC", div: "MWCM", prestige: -9, rivalrySlot: 5 },
  // MWC West: Nevada/UNLV (Fremont Cannon), Fresno State/San Jose State (Old Oil Can), Hawaii/San Diego State (weak pairing)
  { name: "NEV", fullName: "Nevada", mascot: "Wolf Pack", conf: "MWC", div: "MWCW", prestige: -10, rivalrySlot: 6 },
  { name: "UNLV", fullName: "UNLV", mascot: "Rebels", conf: "MWC", div: "MWCW", prestige: -11, rivalrySlot: 7 },
  { name: "FRES", fullName: "Fresno State", mascot: "Bulldogs", conf: "MWC", div: "MWCW", prestige: 5, rivalrySlot: 8 },
  { name: "SJSU", fullName: "San Jose State", mascot: "Spartans", conf: "MWC", div: "MWCW", prestige: -8, rivalrySlot: 9 },
  { name: "HAW", fullName: "Hawaii", mascot: "Rainbow Warriors", conf: "MWC", div: "MWCW", prestige: -6, rivalrySlot: 10 },
  { name: "SDSU", fullName: "San Diego State", mascot: "Aztecs", conf: "MWC", div: "MWCW", prestige: -2, rivalrySlot: 11 },

  // AAC North: UConn/UMass, East Carolina/Old Dominion, Marshall/Liberty (weak pairing)
  { name: "CONN", fullName: "Connecticut", mascot: "Huskies", conf: "AAC", div: "AACN", prestige: -16, rivalrySlot: 0 },
  { name: "MASS", fullName: "Massachusetts", mascot: "Minutemen", conf: "AAC", div: "AACN", prestige: -24, rivalrySlot: 1 },
  { name: "ECU", fullName: "East Carolina", mascot: "Pirates", conf: "AAC", div: "AACN", prestige: -3, rivalrySlot: 2 },
  { name: "ODU", fullName: "Old Dominion", mascot: "Monarchs", conf: "AAC", div: "AACN", prestige: -14, rivalrySlot: 3 },
  { name: "MRSH", fullName: "Marshall", mascot: "Thundering Herd", conf: "AAC", div: "AACN", prestige: -2, rivalrySlot: 4 },
  { name: "LIB", fullName: "Liberty", mascot: "Flames", conf: "AAC", div: "AACN", prestige: -4, rivalrySlot: 5 },
  // AAC South: Appalachian State/Western Carolina (Old Mountain Jug), FAU/FIU (Shula Bowl), Charlotte/Coastal Carolina (weak pairing)
  { name: "APP", fullName: "Appalachian State", mascot: "Mountaineers", conf: "AAC", div: "AACS", prestige: -1, rivalrySlot: 6 },
  { name: "WCU", fullName: "Western Carolina", mascot: "Catamounts", conf: "AAC", div: "AACS", prestige: -27, rivalrySlot: 7 },
  { name: "FAU", fullName: "Florida Atlantic", mascot: "Owls", conf: "AAC", div: "AACS", prestige: -13, rivalrySlot: 8 },
  { name: "FIU", fullName: "Florida International", mascot: "Panthers", conf: "AAC", div: "AACS", prestige: -20, rivalrySlot: 9 },
  { name: "CLT", fullName: "Charlotte", mascot: "49ers", conf: "AAC", div: "AACS", prestige: -19, rivalrySlot: 10 },
  { name: "CCU", fullName: "Coastal Carolina", mascot: "Chanticleers", conf: "AAC", div: "AACS", prestige: -8, rivalrySlot: 11 },

  // SWC West: Houston/Rice (Bayou Bucket), UTEP/New Mexico State (Battle of I-10), UTSA/Texas State
  { name: "HOU", fullName: "Houston", mascot: "Cougars", conf: "SWC", div: "SWCW", prestige: 2, rivalrySlot: 0 },
  { name: "RICE", fullName: "Rice", mascot: "Owls", conf: "SWC", div: "SWCW", prestige: -9, rivalrySlot: 1 },
  { name: "UTEP", fullName: "Texas-El Paso", mascot: "Miners", conf: "SWC", div: "SWCW", prestige: -19, rivalrySlot: 2 },
  { name: "NMSU", fullName: "New Mexico State", mascot: "Aggies", conf: "SWC", div: "SWCW", prestige: -21, rivalrySlot: 3 },
  { name: "UTSA", fullName: "Texas-San Antonio", mascot: "Roadrunners", conf: "SWC", div: "SWCW", prestige: -5, rivalrySlot: 4 },
  { name: "TXST", fullName: "Texas State", mascot: "Bobcats", conf: "SWC", div: "SWCW", prestige: -14, rivalrySlot: 5 },
  // SWC East: Memphis/Tulsa, SMU/North Texas, Missouri State/Tulane (weak pairing)
  { name: "MEM", fullName: "Memphis", mascot: "Tigers", conf: "SWC", div: "SWCE", prestige: 1, rivalrySlot: 6 },
  { name: "TLSA", fullName: "Tulsa", mascot: "Golden Hurricane", conf: "SWC", div: "SWCE", prestige: -7, rivalrySlot: 7 },
  { name: "SMU", fullName: "SMU", mascot: "Mustangs", conf: "SWC", div: "SWCE", prestige: -1, rivalrySlot: 8 },
  { name: "UNT", fullName: "North Texas", mascot: "Mean Green", conf: "SWC", div: "SWCE", prestige: -14, rivalrySlot: 9 },
  { name: "MOST", fullName: "Missouri State", mascot: "Bears", conf: "SWC", div: "SWCE", prestige: -17, rivalrySlot: 10 },
  { name: "TULN", fullName: "Tulane", mascot: "Green Wave", conf: "SWC", div: "SWCE", prestige: -7, rivalrySlot: 11 },

  // Big Sky North: Montana/Montana State (Brawl of the Wild), North Dakota/North Dakota State, Eastern Washington/Portland State
  { name: "MONT", fullName: "Montana", mascot: "Grizzlies", conf: "SKY", div: "SKYN", prestige: -2, rivalrySlot: 0 },
  { name: "MTST", fullName: "Montana State", mascot: "Bobcats", conf: "SKY", div: "SKYN", prestige: -3, rivalrySlot: 1 },
  { name: "UND", fullName: "North Dakota", mascot: "Fighting Hawks", conf: "SKY", div: "SKYN", prestige: -12, rivalrySlot: 2 },
  { name: "NDSU", fullName: "North Dakota State", mascot: "Bison", conf: "SKY", div: "SKYN", prestige: 3, rivalrySlot: 3 },
  { name: "EWU", fullName: "Eastern Washington", mascot: "Eagles", conf: "SKY", div: "SKYN", prestige: -20, rivalrySlot: 4 },
  { name: "PRST", fullName: "Portland State", mascot: "Vikings", conf: "SKY", div: "SKYN", prestige: -29, rivalrySlot: 5 },
  // Big Sky South: South Dakota/South Dakota State (Dakota Marker), Idaho/Idaho State (Battle of the Domes), Northern Iowa/Southern Illinois
  { name: "SDAK", fullName: "South Dakota", mascot: "Coyotes", conf: "SKY", div: "SKYS", prestige: -7, rivalrySlot: 6 },
  { name: "SDST", fullName: "South Dakota State", mascot: "Jackrabbits", conf: "SKY", div: "SKYS", prestige: 6, rivalrySlot: 7 },
  { name: "IDHO", fullName: "Idaho", mascot: "Vandals", conf: "SKY", div: "SKYS", prestige: -12, rivalrySlot: 8 },
  { name: "IDST", fullName: "Idaho State", mascot: "Bengals", conf: "SKY", div: "SKYS", prestige: -35, rivalrySlot: 9 },
  { name: "UNI", fullName: "Northern Iowa", mascot: "Panthers", conf: "SKY", div: "SKYS", prestige: -8, rivalrySlot: 10 },
  { name: "SIU", fullName: "Southern Illinois", mascot: "Salukis", conf: "SKY", div: "SKYS", prestige: -6, rivalrySlot: 11 },
];

export const CONFERENCE_NAMES_144: Record<string, string> = {
  SEC: "SEC",
  B1G: "Big Ten",
  P12: "Pac-12",
  ACC: "ACC",
  B12: "Big 12",
  BEC: "BEC",
  SBT: "Sun Belt",
  MAC: "MAC",
  MWC: "Mountain West",
  AAC: "AAC",
  SWC: "SWC",
  SKY: "Big Sky",
};

export const DIVISION_NAMES_144: Record<string, string> = {
  SECW: "SEC West",
  SECE: "SEC East",
  B1GW: "Big Ten West",
  B1GE: "Big Ten East",
  P12S: "Pac-12 South",
  P12N: "Pac-12 North",
  ACCA: "ACC Atlantic",
  ACCC: "ACC Coastal",
  B12S: "Big 12 South",
  B12N: "Big 12 North",
  BECW: "BEC West",
  BECE: "BEC East",
  SBTW: "Sun Belt West",
  SBTE: "Sun Belt East",
  MACE: "MAC East",
  MACW: "MAC West",
  MWCM: "Mountain West Mountain",
  MWCW: "Mountain West West",
  AACS: "AAC South",
  AACN: "AAC North",
  SWCW: "SWC West",
  SWCE: "SWC East",
  SKYN: "Big Sky North",
  SKYS: "Big Sky South",
};
