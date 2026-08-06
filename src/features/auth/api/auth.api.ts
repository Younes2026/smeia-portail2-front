import { httpClient } from '@/core/api/http-client';
import { technicianApi } from '@/core/api/technician.api';
import type { DirectusResource } from '@/features/repairs/model/repair.types';
import type {
  AuthCustomer,
  AuthSavAgent,
  AuthSession,
  AuthTechnician,
  AuthUser,
} from '@/store/auth.store';

type DirectusLoginResponse = {
  access_token: string;
  refresh_token?: string | null;
  expires?: number | null;
};

type LoginBody = {
  email: string;
  password: string;
  mode: 'json';
};

type LogoutBody = {
  refresh_token: string;
  mode: 'json';
};

type DirectusUserResponse = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
};

type DirectusCustomerResponse = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

type DirectusSavAgentWorkshopResponse = {
  id: number;
  name?: string | null;
};

type DirectusSavAgentResponse = {
  id: number;
  directus_user_id?: string | { id: string } | null;
  active?: boolean | null;
  workshop_id?: number | DirectusSavAgentWorkshopResponse | null;
};

function buildSavAgentEndpoint(directusUserId: string): string {
  const searchParams = new URLSearchParams({
    fields: 'id,directus_user_id,active,workshop_id.*',
    limit: '1',
  });

  searchParams.set('filter[directus_user_id][_eq]', directusUserId);
  searchParams.set('filter[active][_eq]', 'true');

  return `/items/sav_agents?${searchParams.toString()}`;
}

function getSavAgentUserId(
  userId: DirectusSavAgentResponse['directus_user_id'],
  fallback: string
): string {
  if (typeof userId === 'string') {
    return userId;
  }

  return userId?.id ?? fallback;
}

function getSavAgentWorkshopId(
  workshop: DirectusSavAgentResponse['workshop_id']
): number | null {
  if (typeof workshop === 'number') {
    return workshop;
  }

  return workshop?.id ?? null;
}

function getSavAgentWorkshopName(
  workshop: DirectusSavAgentResponse['workshop_id']
): string | null {
  if (typeof workshop === 'number') {
    return null;
  }

  return workshop?.name ?? null;
}

function getTechnicianUserId(
  userId: string | { id: string } | null | undefined,
  fallback: string
): string {
  if (typeof userId === 'string') {
    return userId;
  }

  return userId?.id ?? fallback;
}

function getTechnicianWorkshopId(
  workshop: DirectusResource['workshop_id']
): number | null {
  if (typeof workshop === 'number') {
    return workshop;
  }

  return workshop?.id ?? null;
}

function getTechnicianWorkshopName(
  workshop: DirectusResource['workshop_id']
): string | null {
  if (typeof workshop === 'number') {
    return null;
  }

  return workshop?.name ?? null;
}

export const authApi = {
  loginWithEmail: async (
    email: string,
    password: string
  ): Promise<AuthSession> => {
    const response = await httpClient.post<DirectusLoginResponse>(
      '/auth/login',
      {
        email,
        password,
        mode: 'json',
      } satisfies LoginBody
    );

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token ?? null,
      expires: response.expires ?? null,
      user: null,
      customer: null,
      savAgent: null,
      technician: null,
    };
  },

  getMe: async (): Promise<AuthUser> => {
    const response = await httpClient.get<DirectusUserResponse>('/users/me');

    return {
      id: response.id,
      email: response.email,
      firstName: response.first_name ?? null,
      lastName: response.last_name ?? null,
    };
  },

  getCurrentCustomer: async (
    directusUserId: string
  ): Promise<AuthCustomer | null> => {
    const customers = await httpClient.get<DirectusCustomerResponse[]>(
      `/items/customers?filter[directus_user_id][_eq]=${directusUserId}`
    );

    const customer = customers[0];

    if (!customer) {
      return null;
    }

    return {
      id: customer.id,
      firstName: customer.first_name ?? null,
      lastName: customer.last_name ?? null,
      email: customer.email ?? null,
      phone: customer.phone ?? null,
      address: customer.address ?? null,
    };
  },

  getCurrentSavAgent: async (
    directusUserId: string
  ): Promise<AuthSavAgent | null> => {
    const savAgents = await httpClient.get<DirectusSavAgentResponse[]>(
      buildSavAgentEndpoint(directusUserId)
    );
    const savAgent = savAgents[0];

    if (!savAgent) {
      return null;
    }

    return {
      id: savAgent.id,
      userId: getSavAgentUserId(savAgent.directus_user_id, directusUserId),
      active: savAgent.active ?? true,
      workshopId: getSavAgentWorkshopId(savAgent.workshop_id),
      workshopName: getSavAgentWorkshopName(savAgent.workshop_id),
    };
  },

  getCurrentTechnician: async (
    directusUserId: string
  ): Promise<AuthTechnician | null> => {
    const technician = await technicianApi.getCurrentTechnicianResource(
      directusUserId
    );

    if (!technician) {
      return null;
    }

    return {
      id: technician.id,
      userId: getTechnicianUserId(technician.directus_user_id, directusUserId),
      active: technician.active ?? true,
      workshopId: getTechnicianWorkshopId(technician.workshop_id),
      workshopName: getTechnicianWorkshopName(technician.workshop_id),
      fullName: technician.full_name ?? null,
      specialty: technician.specialty ?? null,
      dailyHours: technician.daily_hours ?? null,
    };
  },

  logout: async (refreshToken?: string | null): Promise<void> => {
    if (!refreshToken) {
      return;
    }

    await httpClient.post<void>('/auth/logout', {
      refresh_token: refreshToken,
      mode: 'json',
    } satisfies LogoutBody);
  },
};
