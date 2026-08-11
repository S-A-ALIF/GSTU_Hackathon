/**
 * Auth Sanitizer
 * Normalizes user input to prevent data inconsistency.
 */
export const sanitizeAuthInput = (data: any) => {
    return {
        email: data.email ? data.email.toLowerCase().trim() : '',
        password: data.password || '',
        role: data.role ? data.role.toLowerCase().trim() : 'student',
        name: data.name ? data.name.trim() : '',
        student_id: data.student_id ? data.student_id.trim().toUpperCase() : '',
        batch_session: data.batch_session ? data.batch_session.trim() : ''
    };
};