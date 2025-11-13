import { SupabaseClient } from '@supabase/supabase-js';

interface CalendarEvent {
  summary: string;
  description?: string;
  start: {
    date: string; // YYYY-MM-DD format
    timeZone?: string;
  };
  end: {
    date: string; // YYYY-MM-DD format
    timeZone?: string;
  };
}

interface GoogleTokens {
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string;
}

interface Grant {
  id: string;
  title: string;
  agency: string | null;
  close_date: string | null;
  external_id: string;
  description: string | null;
  google_calendar_event_id: string | null;
}

export class GoogleCalendarService {
  private supabase: SupabaseClient;
  private clientId: string;
  private clientSecret: string;
  private appUrl: string;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.clientId = process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    this.appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://grantcue.com';

    if (!this.clientId || !this.clientSecret) {
      console.warn('[GoogleCalendarService] Google OAuth credentials not configured');
    }
  }

  /**
   * Get Google Calendar integration for an organization
   */
  private async getIntegration(orgId: string): Promise<GoogleTokens | null> {
    try {
      const { data, error } = await this.supabase
        .from('integrations')
        .select('access_token, refresh_token, token_expires_at')
        .eq('org_id', orgId)
        .eq('integration_type', 'google_calendar')
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return null;
      }

      return data as GoogleTokens;
    } catch (err) {
      console.error('[GoogleCalendarService] Error fetching integration:', err);
      return null;
    }
  }

  /**
   * Refresh an expired access token
   */
  private async refreshAccessToken(
    orgId: string,
    refreshToken: string
  ): Promise<string | null> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GoogleCalendarService] Token refresh failed:', errorText);
        return null;
      }

      const tokens = await response.json();
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

      // Update the integration with new tokens
      const { error: updateError } = await this.supabase
        .from('integrations')
        .update({
          access_token: tokens.access_token,
          token_expires_at: expiresAt.toISOString(),
        })
        .eq('org_id', orgId)
        .eq('integration_type', 'google_calendar');

      if (updateError) {
        console.error('[GoogleCalendarService] Error updating tokens:', updateError);
        return null;
      }

      console.log('[GoogleCalendarService] Access token refreshed successfully');
      return tokens.access_token;
    } catch (err) {
      console.error('[GoogleCalendarService] Error refreshing token:', err);
      return null;
    }
  }

  /**
   * Get a valid access token (refresh if needed)
   */
  private async getValidAccessToken(orgId: string): Promise<string | null> {
    const integration = await this.getIntegration(orgId);
    if (!integration) {
      return null;
    }

    // Check if token is expired or about to expire (within 5 minutes)
    const expiresAt = new Date(integration.token_expires_at);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (expiresAt <= fiveMinutesFromNow) {
      // Token is expired or about to expire, refresh it
      if (!integration.refresh_token) {
        console.error('[GoogleCalendarService] No refresh token available');
        return null;
      }

      return await this.refreshAccessToken(orgId, integration.refresh_token);
    }

    return integration.access_token;
  }

  /**
   * Create a calendar event for a grant deadline
   */
  async createEvent(grant: Grant, orgId: string): Promise<string | null> {
    try {
      // Skip if no deadline
      if (!grant.close_date) {
        console.log('[GoogleCalendarService] No deadline for grant, skipping event creation');
        return null;
      }

      // Get valid access token
      const accessToken = await this.getValidAccessToken(orgId);
      if (!accessToken) {
        console.log('[GoogleCalendarService] No valid Google Calendar integration found');
        return null;
      }

      // Prepare event data
      const eventDate = grant.close_date.split('T')[0]; // Extract YYYY-MM-DD
      const grantUrl = `${this.appUrl}/grants/${grant.id}`;

      let eventDescription = `Grant Deadline\n\n`;
      if (grant.agency) {
        eventDescription += `Agency: ${grant.agency}\n`;
      }
      if (grant.description) {
        // Truncate description to 2000 chars (Google Calendar limit is 8KB)
        const truncatedDesc = grant.description.substring(0, 2000);
        eventDescription += `\nDescription:\n${truncatedDesc}${grant.description.length > 2000 ? '...' : ''}\n`;
      }
      eventDescription += `\nView in GrantCue: ${grantUrl}`;

      const event: CalendarEvent = {
        summary: `📅 ${grant.title}`,
        description: eventDescription,
        start: {
          date: eventDate,
          timeZone: 'America/New_York',
        },
        end: {
          date: eventDate,
          timeZone: 'America/New_York',
        },
      };

      // Create event in Google Calendar
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GoogleCalendarService] Event creation failed:', errorText);
        return null;
      }

      const createdEvent = await response.json();
      console.log('[GoogleCalendarService] Event created:', createdEvent.id);
      return createdEvent.id;
    } catch (err) {
      console.error('[GoogleCalendarService] Error creating event:', err);
      return null;
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(grant: Grant, orgId: string): Promise<boolean> {
    try {
      // If no deadline, delete the event if it exists
      if (!grant.close_date) {
        if (grant.google_calendar_event_id) {
          return await this.deleteEvent(grant.google_calendar_event_id, orgId);
        }
        return true;
      }

      // If there's no existing event ID, create a new event
      if (!grant.google_calendar_event_id) {
        const eventId = await this.createEvent(grant, orgId);
        if (eventId) {
          // Update the grant with the new event ID
          await this.supabase
            .from('org_grants_saved')
            .update({ google_calendar_event_id: eventId })
            .eq('id', grant.id);
          return true;
        }
        return false;
      }

      // Get valid access token
      const accessToken = await this.getValidAccessToken(orgId);
      if (!accessToken) {
        console.log('[GoogleCalendarService] No valid Google Calendar integration found');
        return false;
      }

      // Prepare updated event data
      const eventDate = grant.close_date.split('T')[0]; // Extract YYYY-MM-DD
      const grantUrl = `${this.appUrl}/grants/${grant.id}`;

      let eventDescription = `Grant Deadline\n\n`;
      if (grant.agency) {
        eventDescription += `Agency: ${grant.agency}\n`;
      }
      if (grant.description) {
        const truncatedDesc = grant.description.substring(0, 2000);
        eventDescription += `\nDescription:\n${truncatedDesc}${grant.description.length > 2000 ? '...' : ''}\n`;
      }
      eventDescription += `\nView in GrantCue: ${grantUrl}`;

      const event: CalendarEvent = {
        summary: `📅 ${grant.title}`,
        description: eventDescription,
        start: {
          date: eventDate,
          timeZone: 'America/New_York',
        },
        end: {
          date: eventDate,
          timeZone: 'America/New_York',
        },
      };

      // Update event in Google Calendar
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${grant.google_calendar_event_id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GoogleCalendarService] Event update failed:', errorText);

        // If event not found (404), it may have been deleted manually
        // Create a new event instead
        if (response.status === 404) {
          console.log('[GoogleCalendarService] Event not found, creating new one');
          const newEventId = await this.createEvent(grant, orgId);
          if (newEventId) {
            await this.supabase
              .from('org_grants_saved')
              .update({ google_calendar_event_id: newEventId })
              .eq('id', grant.id);
            return true;
          }
        }
        return false;
      }

      console.log('[GoogleCalendarService] Event updated:', grant.google_calendar_event_id);
      return true;
    } catch (err) {
      console.error('[GoogleCalendarService] Error updating event:', err);
      return false;
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(eventId: string, orgId: string): Promise<boolean> {
    try {
      // Get valid access token
      const accessToken = await this.getValidAccessToken(orgId);
      if (!accessToken) {
        console.log('[GoogleCalendarService] No valid Google Calendar integration found');
        return false;
      }

      // Delete event from Google Calendar
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok && response.status !== 404) {
        // 404 is acceptable - event already deleted
        const errorText = await response.text();
        console.error('[GoogleCalendarService] Event deletion failed:', errorText);
        return false;
      }

      console.log('[GoogleCalendarService] Event deleted:', eventId);
      return true;
    } catch (err) {
      console.error('[GoogleCalendarService] Error deleting event:', err);
      return false;
    }
  }

  /**
   * Sync a grant with Google Calendar
   * This is the main entry point for grant changes
   */
  async syncGrant(grant: Grant, orgId: string): Promise<void> {
    try {
      // Check if Google Calendar is connected for this org
      const integration = await this.getIntegration(orgId);
      if (!integration) {
        console.log('[GoogleCalendarService] Google Calendar not connected for org:', orgId);
        return;
      }

      // If grant has a deadline, create or update the event
      if (grant.close_date) {
        if (grant.google_calendar_event_id) {
          // Update existing event
          await this.updateEvent(grant, orgId);
        } else {
          // Create new event
          const eventId = await this.createEvent(grant, orgId);
          if (eventId) {
            // Store the event ID in the database
            await this.supabase
              .from('org_grants_saved')
              .update({ google_calendar_event_id: eventId })
              .eq('id', grant.id);
          }
        }
      } else if (grant.google_calendar_event_id) {
        // No deadline but event exists - delete it
        await this.deleteEvent(grant.google_calendar_event_id, orgId);
        // Clear the event ID from the database
        await this.supabase
          .from('org_grants_saved')
          .update({ google_calendar_event_id: null })
          .eq('id', grant.id);
      }
    } catch (err) {
      console.error('[GoogleCalendarService] Error syncing grant:', err);
      // Don't throw - we don't want calendar sync failures to break the main flow
    }
  }

  /**
   * Delete calendar event when grant is deleted
   */
  async handleGrantDeletion(grant: Grant, orgId: string): Promise<void> {
    try {
      if (grant.google_calendar_event_id) {
        await this.deleteEvent(grant.google_calendar_event_id, orgId);
      }
    } catch (err) {
      console.error('[GoogleCalendarService] Error handling grant deletion:', err);
      // Don't throw - we don't want calendar sync failures to break the main flow
    }
  }
}
