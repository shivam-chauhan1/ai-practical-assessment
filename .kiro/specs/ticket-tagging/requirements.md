# Requirements Document

## Introduction

This feature adds a Tag entity with a many-to-many relationship to Ticket, enabling staff to categorize tickets with reusable labels. The ticket list page is extended to support filtering by tag alongside the existing status filter, giving staff a fast way to locate related tickets.

## Glossary

- **Tag**: A reusable label that can be attached to one or more Tickets for categorization purposes.
- **Tag_Service**: The server-side service layer responsible for Tag CRUD operations and tag-ticket associations.
- **Ticket_Service**: The existing server-side service layer responsible for Ticket operations, extended to support tag filtering.
- **Tag_Filter**: A UI control on the ticket list page that allows selecting one or more tags to narrow the displayed tickets.
- **API**: The Express REST backend serving JSON responses to the React client.

## Requirements

### Requirement 1: Tag Entity Schema

**User Story:** As a developer, I want a Tag entity with a many-to-many relationship to Ticket in the database schema, so that tickets can be categorized with reusable labels.

#### Acceptance Criteria

1. THE Tag entity SHALL have an id field (UUID, primary key), a name field (string, unique, minimum 1 character, maximum 50 characters, trimmed of leading/trailing whitespace), and a createdAt field (timestamp, auto-set on creation)
2. THE schema SHALL define an implicit many-to-many relationship between Tag and Ticket using a join table, allowing a single ticket to have at most 20 tags and a single tag to be associated with unlimited tickets
3. WHEN a Prisma migration is generated, THE migration SHALL create the Tag table and the join table with foreign keys referencing Tag.id and Ticket.id, with cascading deletes on the join table rows when either the referenced Tag or Ticket is deleted; IF migration generation fails, THEN foreign keys and cascading deletes SHALL be configurable independently through manual schema adjustments without requiring a successful migration run
4. THE Tag name field SHALL enforce a case-insensitive unique constraint at the database level, so that "Bug" and "bug" are treated as duplicates
5. IF a Tag is deleted, THEN THE system SHALL remove all corresponding join table entries without deleting the associated Tickets

### Requirement 2: Tag CRUD Endpoints

**User Story:** As a staff member, I want API endpoints to create, list, and delete tags, so that I can manage the available set of tags.

#### Acceptance Criteria

1. WHEN a POST request is sent to the tags endpoint with a valid name, THE API SHALL trim leading and trailing whitespace from the name, create the tag, and return the created tag object (id, name, createdAt) with a 201 status code
2. IF a POST request is sent with a name that matches an existing tag name using case-insensitive comparison, THEN THE API SHALL return a 409 conflict error
3. IF a POST request is sent with a name that is empty, contains only whitespace, or exceeds 50 characters after trimming, THEN THE API SHALL return a 400 validation error
4. WHEN a GET request is sent to the tags endpoint, THE API SHALL return all tags as an array of tag objects (id, name, createdAt) ordered alphabetically by name using case-insensitive sorting
5. WHEN a DELETE request is sent to the tags endpoint with a valid tag id, THE API SHALL remove the tag and all its ticket associations, returning a 204 status code with no response body
6. IF a DELETE request is sent with a non-existent tag id, THEN THE API SHALL return a 404 not found error
7. IF a DELETE request is sent with a tag id that is not a valid UUID format, THEN THE API SHALL return a 400 validation error

### Requirement 3: Attach and Detach Tags on Tickets

**User Story:** As a staff member, I want to attach and detach tags on a ticket, so that I can categorize tickets as their scope becomes clear.

#### Acceptance Criteria

1. WHEN a ticket is created with a tags array containing between 1 and 10 valid tag ids in the request body, THE Ticket_Service SHALL associate the specified tags with the new ticket
2. WHEN a ticket is updated with a tags array in the request body, THE Ticket_Service SHALL replace the ticket's current tag associations with the provided set, where an empty array removes all tag associations and an omitted tags field leaves existing associations unchanged
3. IF the tags array contains a tag id that does not exist, THEN THE API SHALL return a 400 validation error identifying each invalid tag id
4. IF the tags array contains more than 10 tag ids, THEN THE API SHALL return a 400 validation error indicating the maximum number of tags per ticket is 10
5. WHEN a ticket is retrieved by id, THE API SHALL include the associated tags in the response, where each tag object contains its id, name, and createdAt fields
6. WHEN tickets are listed, THE API SHALL include the associated tags in each ticket response object, where each tag object contains its id, name, and createdAt fields

### Requirement 4: Filter Tickets by Tag

**User Story:** As a staff member, I want to filter the ticket list by one or more tags, so that I can quickly find tickets in a specific category.

#### Acceptance Criteria

1. WHEN a GET request to the tickets endpoint includes a tag query parameter with one or more comma-separated tag ids (maximum 10 ids per request), THE Ticket_Service SHALL return only tickets that have at least one of the specified tags
2. WHEN the tag filter is combined with the keyword filter, THE Ticket_Service SHALL apply both filters with AND logic, returning only tickets that match the keyword AND have at least one of the specified tags
3. WHEN the tag filter is combined with the status filter, THE Ticket_Service SHALL apply both filters with AND logic, returning only tickets that match the status AND have at least one of the specified tags
4. WHEN the tag query parameter is empty or absent, THE Ticket_Service SHALL return tickets without any tag filtering
5. IF the tag query parameter contains a tag id that does not exist in the database, THEN THE Ticket_Service SHALL ignore that non-existent id and filter using only the remaining valid tag ids
6. IF all tag ids in the tag query parameter are non-existent, THEN THE Ticket_Service SHALL return an empty list

### Requirement 5: Tag Filter UI

**User Story:** As a staff member, I want a tag filter control on the ticket list page, so that I can visually select tags to narrow results.

#### Acceptance Criteria

1. WHEN the ticket list page loads, THE Tag_Filter SHALL fetch and display all available tags as selectable options, each showing the tag name
2. WHEN one or more tags are selected in the Tag_Filter, THE client SHALL send the selected tag ids as comma-separated values in the tag query parameter to the tickets endpoint while preserving any active keyword and status filter parameters
3. WHEN the tag selection changes, THE client SHALL re-fetch the ticket list with the updated filter parameters within 300 milliseconds of the selection event
4. WHEN the staff member activates the clear control in the Tag_Filter, THE Tag_Filter SHALL deselect all tags and THE client SHALL re-fetch the ticket list without any tag filter parameter
5. THE Tag_Filter SHALL render selected tags with a visually distinct style differentiating them from unselected tags such that selected and unselected states are distinguishable without relying on color alone
6. IF the tag list request fails, THEN THE Tag_Filter SHALL display an error message indicating that tags could not be loaded and SHALL allow the staff member to retry the request
7. IF no tags exist in the system, THEN THE Tag_Filter SHALL display a message indicating no tags are available and SHALL not render any selectable options

### Requirement 6: Seed Data with Tags

**User Story:** As a developer, I want the seed script to include sample tags attached to existing tickets, so that the tag feature is demonstrable immediately after seeding.

#### Acceptance Criteria

1. WHEN the seed script runs, THE seed script SHALL create at least 5 distinct tags where each tag name is between 3 and 30 characters long and unique within the seeded set
2. WHEN the seed script runs, THE seed script SHALL associate at least 3 of the seeded tickets with tags, where at least one ticket has 2 or more tags attached to demonstrate multi-tag capability
3. WHEN the seed script runs, THE seed script SHALL create tags after tickets have been seeded, so that tag-to-ticket associations reference existing ticket records; IF user seeding fails but ticket seeding succeeds, THEN THE seed script SHALL proceed with tag creation as long as ticket records exist in the database
4. WHEN the seed script is executed more than once on the same database, THE seed script SHALL produce the same final state without creating duplicate tags or duplicate tag-ticket associations, using upsert logic for tags and idempotent connect logic for associations
5. WHEN the seed script completes tag seeding, THE seed script SHALL log the number of tags created and the number of tag-ticket associations established
