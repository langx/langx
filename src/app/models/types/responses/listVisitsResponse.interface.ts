import { Visit } from 'src/app/models/Visit';

export interface listVisitsResponseInterface {
  total: number;
  documents: Visit[];
}
