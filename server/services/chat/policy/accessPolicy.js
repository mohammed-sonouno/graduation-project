import { AppError } from '../../../utils/AppError.js';
import { schemaMetadata } from '../schema/metadata.js';

export const PlanTypes = Object.freeze({
  GREET: 'GREET',
  HELP: 'HELP',
  UNKNOWN: 'UNKNOWN',
  EVENTS_LIST: 'EVENTS_LIST',
  EVENTS_COUNT: 'EVENTS_COUNT',
  EVENTS_SEARCH: 'EVENTS_SEARCH',
  EVENT_DETAILS: 'EVENT_DETAILS',
  COMMUNITIES_LIST: 'COMMUNITIES_LIST',
  COMMUNITIES_SEARCH: 'COMMUNITIES_SEARCH',
  NOTIFICATIONS_LIST: 'NOTIFICATIONS_LIST',
  REGISTRATIONS_LIST: 'REGISTRATIONS_LIST',
  WHOAMI: 'WHOAMI',
  ENGINEERING_RECOMMEND: 'ENGINEERING_RECOMMEND',
  ENGINEERING_ACCEPTANCE_QUERY: 'ENGINEERING_ACCEPTANCE_QUERY',
  ENGINEERING_COMPARE: 'ENGINEERING_COMPARE',
  ENGINEERING_FOLLOWUP_RANK: 'ENGINEERING_FOLLOWUP_RANK',
  MAJOR_ADVISOR_SNAPSHOT: 'MAJOR_ADVISOR_SNAPSHOT',
  MAJOR_ADVISOR_BEST: 'MAJOR_ADVISOR_BEST',
  UNIVERSITY_INFO: 'UNIVERSITY_INFO',
  FACULTY_INFO: 'FACULTY_INFO',
  FEEDBACK_CORRECTION: 'FEEDBACK_CORRECTION'
});

export class AccessPolicyGuard {
  constructor({ metadata = schemaMetadata } = {}) {
    this.metadata = metadata;
  }

  assertPlanAllowed({ plan, userId }) {
    if (!plan?.type) throw new AppError('Invalid plan', { statusCode: 500, code: 'PLAN_INVALID' });

    const allowed = new Set(Object.values(PlanTypes));
    if (!allowed.has(plan.type)) {
      throw new AppError('This question is not supported yet (blocked by policy).', {
        statusCode: 400,
        code: 'PLAN_BLOCKED'
      });
    }

    if (plan.type === PlanTypes.NOTIFICATIONS_LIST || plan.type === PlanTypes.REGISTRATIONS_LIST) {
      if (plan.userId !== userId) {
        throw new AppError('Access denied.', { statusCode: 403, code: 'ACCESS_DENIED' });
      }
    }

    if (plan.type === PlanTypes.GREET || plan.type === PlanTypes.WHOAMI) {
      const users = this.metadata.entities.users_safe;
      if (!users) {
        throw new AppError('Safety metadata missing for users.', { statusCode: 500, code: 'METADATA_MISSING' });
      }
    }

    if (
      plan.type === PlanTypes.ENGINEERING_RECOMMEND ||
      plan.type === PlanTypes.ENGINEERING_ACCEPTANCE_QUERY ||
      plan.type === PlanTypes.ENGINEERING_COMPARE ||
      plan.type === PlanTypes.ENGINEERING_FOLLOWUP_RANK ||
      plan.type === PlanTypes.MAJOR_ADVISOR_SNAPSHOT ||
      plan.type === PlanTypes.MAJOR_ADVISOR_BEST ||
      plan.type === PlanTypes.UNIVERSITY_INFO ||
      plan.type === PlanTypes.FACULTY_INFO
    ) {
      return;
    }
  }
}
