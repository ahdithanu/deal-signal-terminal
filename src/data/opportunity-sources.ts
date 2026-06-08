import {
  rawPermitSignals as elDoradoRawPermitSignals,
  opportunitySeeds as elDoradoOpportunitySeeds,
} from "@/data/eldorado-west-slope";
import { markets } from "@/data/markets";
import {
  rawPermitSignals as sanDiegoRawPermitSignals,
  opportunitySeeds as sanDiegoOpportunitySeeds,
} from "@/data/san-diego-development";
import type { MarketDefinition, OpportunitySeed, PermitSignal } from "@/types/domain";

export type OpportunitySourceBatch = {
  market: MarketDefinition;
  seeds: OpportunitySeed[];
  signals: PermitSignal[];
};

export const opportunitySourceBatches: OpportunitySourceBatch[] = [
  {
    market: markets["ca-eldorado-west-slope"],
    seeds: elDoradoOpportunitySeeds,
    signals: elDoradoRawPermitSignals,
  },
  {
    market: markets["ca-san-diego-development"],
    seeds: sanDiegoOpportunitySeeds,
    signals: sanDiegoRawPermitSignals,
  },
];
