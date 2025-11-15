# SQL Diagnostic Files

This directory contains SQL diagnostic and utility files that were previously in the project root.

## Files

### Migration Checks
- `check-migrations.sql` - Verifies migration status
- `check_remote_migrations.sql` - Checks remote migration status
- `fix-migrations-sql.sql` - Migration fixes

### Data Diagnostics
- `database_diagnostics.sql` - General database diagnostic queries
- `diagnostic_queries.sql` - Additional diagnostic queries
- `check_all_grant_sources.sql` - Validates grant source data
- `check_discover_page_data.sql` - Checks discover page data integrity

### Data Fixes
- `fix_bad_data.sql` - Data cleanup and correction queries
- `quick_fix.sql` - Quick fix queries

## Usage

These files are kept for reference and diagnostic purposes. They should not be run in production without careful review.

To use any of these files:
1. Review the SQL carefully
2. Test in a development environment first
3. Run with appropriate database permissions
4. Consider backing up data before running fix scripts
