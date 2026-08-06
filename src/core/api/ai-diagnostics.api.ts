import { HttpError, httpClient } from '@/core/api/http-client';

export type AiDiagnosticUrgencyLevel = 'low' | 'medium' | 'high';

export type AiDiagnosticAnswer = {
  question: string;
  answer: string;
};

export type AiDiagnosticImageMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp';

export type AiDiagnosticPhoto = {
  mime_type: AiDiagnosticImageMimeType;
  data_url: string;
};

export type AnalyzeAiDiagnosticInput = {
  vehicle_id: number;
  description: string;
  answers: AiDiagnosticAnswer[];
  photo?: AiDiagnosticPhoto | null;
};

export type AiDiagnosisStatus =
  | 'needs_questions'
  | 'ready'
  | 'out_of_scope';

export type AiDiagnosticOutputUrgencyLevel =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export type AiDiagnosticDrivingAdvice =
  | 'normal'
  | 'caution'
  | 'stop_if_possible'
  | 'do_not_drive';

export type AiDiagnosticConfidence = 'low' | 'medium' | 'high';

export type AiDiagnosticServiceTypeId = 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type AiDiagnosticWorkshopId = 1 | 2 | 3 | 4;

export type AiDiagnosticImageAnalysis = {
  image_provided: boolean;
  useful: boolean;
  observations: string | null;
  photo_suggested: boolean;
  requested_image_hint: string | null;
};

export type AiDiagnosticQuestion = {
  id: string;
  text: string;
  answer_type: 'yes_no' | 'single_choice' | 'free_text';
  options: string[];
};

export type AiDiagnosticResult = {
  diagnosis_status: AiDiagnosisStatus;
  problem_summary: string;
  image_analysis: AiDiagnosticImageAnalysis;
  urgency_level: AiDiagnosticOutputUrgencyLevel;
  driving_advice: AiDiagnosticDrivingAdvice;
  safety_message: string | null;
  suggested_service_type_id: AiDiagnosticServiceTypeId | null;
  suggested_workshop_ids: AiDiagnosticWorkshopId[];
  questions: AiDiagnosticQuestion[];
  client_message: string;
  sav_notes: string;
  confidence: AiDiagnosticConfidence;
};

export type DirectusAiDiagnosticCustomer = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type DirectusAiDiagnosticVehicle = {
  id: number;
  model?: string | null;
  registration_number?: string | null;
  vin?: string | null;
  year?: number | null;
  mileage?: number | null;
};

export type DirectusAiDiagnosticAppointment = {
  id: number | string;
  requested_date?: string | null;
  requested_time?: string | null;
  status?: string | null;
};

export type CreateAiDiagnosticInput = {
  customerId: number;
  vehicleId: number;
  problemDescription: string;
  aiQuestions: string[];
  clientAnswers: AiDiagnosticAnswer[];
  problemSummary: string;
  urgencyLevel: AiDiagnosticUrgencyLevel;
  aiRecommendation: string;
  appointmentId?: number | string | null;
  suggestedServiceTypeId?: number | null;
};

export type DirectusAiDiagnostic = {
  id: number | string;
  customer_id: number | DirectusAiDiagnosticCustomer;
  vehicle_id: number | DirectusAiDiagnosticVehicle;
  appointment_id?:
    | number
    | string
    | DirectusAiDiagnosticAppointment
    | null;
  problem_description: string;
  ai_questions?: string[] | string | null;
  client_answers?:
    | AiDiagnosticAnswer[]
    | string[]
    | Record<string, unknown>
    | string
    | null;
  problem_summary?: string | null;
  suggested_service_type_id?: number | { id: number } | null;
  urgency_level?: AiDiagnosticUrgencyLevel | string | null;
  ai_recommendation?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type CreateAiDiagnosticBody = {
  customer_id: number;
  vehicle_id: number;
  problem_description: string;
  ai_questions: string[];
  client_answers: AiDiagnosticAnswer[];
  problem_summary: string;
  urgency_level: AiDiagnosticUrgencyLevel;
  ai_recommendation: string;
  appointment_id?: number | string;
  suggested_service_type_id?: number;
};

const AI_DIAGNOSTIC_RELATION_FIELDS = [
  'id',
  'customer_id.*',
  'vehicle_id.*',
  'appointment_id',
  'problem_description',
  'ai_questions',
  'client_answers',
  'problem_summary',
  'urgency_level',
  'ai_recommendation',
  'status',
  'created_at',
] as const;

const AI_DIAGNOSTIC_BASE_FIELDS = [
  'id',
  'customer_id',
  'vehicle_id',
  'appointment_id',
  'problem_description',
  'ai_questions',
  'client_answers',
  'problem_summary',
  'urgency_level',
  'ai_recommendation',
  'status',
  'created_at',
] as const;

function buildAiDiagnosticsEndpoint(fields: readonly string[]): string {
  const searchParams = new URLSearchParams({
    fields: fields.join(','),
    sort: '-created_at',
  });

  return `/items/ai_diagnostics?${searchParams.toString()}`;
}

function canRetryWithoutRelationFields(error: unknown): boolean {
  return error instanceof HttpError && [400, 403].includes(error.status);
}

export function analyzeAiDiagnostic(input: AnalyzeAiDiagnosticInput) {
  return httpClient.post<AiDiagnosticResult>(
    '/api/ai/diagnostics',
    input,
    { destination: 'aiBackend' }
  );
}

export const aiDiagnosticsApi = {
  analyzeAiDiagnostic,

  createAiDiagnostic: ({
    customerId,
    vehicleId,
    problemDescription,
    aiQuestions,
    clientAnswers,
    problemSummary,
    urgencyLevel,
    aiRecommendation,
    appointmentId,
    suggestedServiceTypeId,
  }: CreateAiDiagnosticInput) => {
    const body: CreateAiDiagnosticBody = {
      customer_id: customerId,
      vehicle_id: vehicleId,
      problem_description: problemDescription.trim(),
      ai_questions: aiQuestions,
      client_answers: clientAnswers,
      problem_summary: problemSummary.trim(),
      urgency_level: urgencyLevel,
      ai_recommendation: aiRecommendation.trim(),
    };

    if (appointmentId !== undefined && appointmentId !== null) {
      body.appointment_id = appointmentId;
    }

    if (suggestedServiceTypeId !== undefined && suggestedServiceTypeId !== null) {
      body.suggested_service_type_id = suggestedServiceTypeId;
    }

    return httpClient.post<DirectusAiDiagnostic>(
      '/items/ai_diagnostics',
      body
    );
  },

  getAiDiagnostics: async () => {
    try {
      return await httpClient.get<DirectusAiDiagnostic[]>(
        buildAiDiagnosticsEndpoint(AI_DIAGNOSTIC_RELATION_FIELDS)
      );
    } catch (error) {
      if (!canRetryWithoutRelationFields(error)) {
        throw error;
      }

      return httpClient.get<DirectusAiDiagnostic[]>(
        buildAiDiagnosticsEndpoint(AI_DIAGNOSTIC_BASE_FIELDS)
      );
    }
  },
};
