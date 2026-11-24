import type {Audit, Candidate, Collection, Settings, Value} from './model';
export type Command = {
  type: 'init'
}|{type: 'cancel'}|{
  type: 'settings';
  settings: Settings
}
|{
  type: 'scan';
  scope: 'selection'|'page'
}
|{
  type: 'locate';
  key: string
}
|{
  type: 'pick';
  key: string
}
|{
  type: 'apply';
  key: string;
  id: string;
  expanded: boolean;
  confirmation?: string
};
export type Event = {
  type: 'located'
}|{
  type: 'setup';
  collections: Collection[];
  settings: Settings;
  first: boolean;
  warning: string
}
|{
  type: 'selection';
  count: number
}
|{
  type: 'progress';
  layers: number
}
|{
  type: 'audit';
  audit: Audit;
  notice: string
}
|{
  type: 'error'|'cancelled'|'reset';
  message: string
}
|{
  type: 'picker';
  key: string;
  candidates: Candidate[];
  skipped: number
}
|{
  type: 'confirm';
  key: string;
  id: string;
  before: Value;
  after: Value;
  confirmation: string
};
