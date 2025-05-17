import {
    CognitoIdentityProviderClient,
    AdminUpdateUserAttributesCommand,
    AdminListGroupsForUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { PostAuthenticationTriggerEvent, Context } from 'aws-lambda';

type ClaimValue = boolean | number | string;

interface ClaimSet {
    [claim: string]: ClaimValue;
}

interface Role {
    claimSets: string[];
}

const CLAIM_SETS: Record<string, ClaimSet> = {
    'content_management': {
        'canCreateContent': true,
        'canEditContent': true,
        'canUnlistContent': true,
    },
    'user_management': {
        'canViewUsers': true,
        'canCreateUsers': true,
        'canUpdateUsers': true,
        'canDeleteUsers': true,
    },
    'buyer': {
        'canPlaceMyOrder': true,
        'canManageMyCart': true,
        'canUpdateMyProfile': true,
    },
};
const ROLE_PRECEDENCE = ['admin', 'curator', 'customer'];
const ROLES: Record<string, Role> = {
    'admin': {
        claimSets: ['user_management', 'content_management', 'buyer'],
    },
    'curator': {
        claimSets: ['content_management', 'buyer'],
    },
    'customer': {
        claimSets: ['buyer'],
    },
};

export const handler = async (event: PostAuthenticationTriggerEvent, context: Context): Promise<PostAuthenticationTriggerEvent> => {
    console.log('Post Authentication event:', JSON.stringify(event, null, 2));

    if (!event.request || !event.request.userAttributes) {
        console.log('Not a valid post-authentication event, skipping');
        return event;
    }

    try {
        const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
        const username = event.userName;
        const userPoolId = event.userPoolId;

        if (!username || !userPoolId) {
            console.error('Missing username or userPoolId');
            return event;
        }
        console.log(`Processing user ${username} in pool ${userPoolId}`);

        const userRoles = await fetchUserRoles(client, username, userPoolId);
        const userClaimValues = mapUserRolesToClaims(userRoles);

        await client.send(new AdminUpdateUserAttributesCommand({
            Username: username,
            UserPoolId: userPoolId,
            UserAttributes: [
                {
                    Name: 'custom:claims',
                    Value: JSON.stringify(userClaimValues),
                },
            ],
        }));

        console.log('Successfully updated user claims');
        return event;
    } catch (error) {
        console.error('Error updating user claims:', error instanceof Error ? error.message : 'Unknown error');
        return event;
    }
};

function mapUserRolesToClaims(userRoles: string[]) {
    const userClaimValues: Record<string, ClaimValue> = {};
    for (const role of userRoles) {
        if (!ROLES[role]) {
            console.log(`Warning: Role '${role}' not found in definitions, skipping`);
            continue;
        }

        const roleDefinition = ROLES[role];
        for (const claimSetName of roleDefinition.claimSets) {
            const claimSet = CLAIM_SETS[claimSetName];
            if (!claimSet) {
                console.log(`Warning: ClaimSet '${claimSetName}' not found, skipping`);
                continue;
            }
            for (const [claim, value] of Object.entries(claimSet)) {
                userClaimValues[claim] = value
            }
        }
    }
    console.log('Final resolved claims:', userClaimValues);
    return userClaimValues;
}

async function fetchUserRoles(client: CognitoIdentityProviderClient, username: string, userPoolId: string) {
    const groupsResponse = await client.send(new AdminListGroupsForUserCommand({
        Username: username,
        UserPoolId: userPoolId,
    }));
    console.log('User groups:', JSON.stringify(groupsResponse.Groups || [], null, 2));

    const rawUserRoles = (groupsResponse.Groups || [])
        .map(g => g.GroupName)
        .filter((name): name is string => !!name);

    const userRoles = rawUserRoles.sort((a, b) => {
        const indexA = ROLE_PRECEDENCE.indexOf(a);
        const indexB = ROLE_PRECEDENCE.indexOf(b);
        return indexA - indexB;
    });
    console.log('User roles:', userRoles);
    return userRoles;
}

