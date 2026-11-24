// Reserved interface for v0.2+. No runtime engine is registered in v0.1.0.
import type {Candidate, Property} from '../shared/model';
export interface Suggestion {
  candidate: Candidate;
  match: 'exact'|'approximate';
  explanation: string;
}
export interface SuggestionEngine {
  suggest(property: Property, compatibleSemanticCandidates: readonly Candidate[]):
      readonly Suggestion[];
}
