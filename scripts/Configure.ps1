 
[CmdletBinding()]
param(
    [Parameter(Mandatory=$False, HelpMessage='Tenant ID (This is a GUID which represents the "Directory ID" of the AzureAD tenant into which you want to create the apps')]
    [string] $tenantId,
    [Parameter(Mandatory=$False, HelpMessage='Azure environment to use while running the script. Default = Global')]
    [string] $azureEnvironmentName
)

<#
 This script creates the Azure AD applications needed for this sample and updates the configuration files
 for the visual Studio projects from the data in the Azure AD applications.

 In case you don't have Microsoft.Graph.Applications already installed, the script will automatically install it for the current user
 
 There are two ways to run this script. For more information, read the AppCreationScripts.md file in the same folder as this script.
#>

# Create an application key
# See https://www.sabin.io/blog/adding-an-azure-active-directory-application-and-key-using-powershell/
Function CreateAppKey([DateTime] $fromDate, [double] $durationInMonths)
{
    $key = New-Object Microsoft.Graph.PowerShell.Models.MicrosoftGraphPasswordCredential

    $key.StartDateTime = $fromDate
    $key.EndDateTime = $fromDate.AddMonths($durationInMonths)
    $key.KeyId = (New-Guid).ToString()
    $key.DisplayName = "app secret"

    return $key
}

# Adds the requiredAccesses (expressed as a pipe separated string) to the requiredAccess structure
# The exposed permissions are in the $exposedPermissions collection, and the type of permission (Scope | Role) is 
# described in $permissionType
Function AddResourcePermission($requiredAccess, `
                               $exposedPermissions, [string]$requiredAccesses, [string]$permissionType)
{
    foreach($permission in $requiredAccesses.Trim().Split("|"))
    {
        foreach($exposedPermission in $exposedPermissions)
        {
            if ($exposedPermission.Value -eq $permission)
                {
                $resourceAccess = New-Object Microsoft.Graph.PowerShell.Models.MicrosoftGraphResourceAccess
                $resourceAccess.Type = $permissionType # Scope = Delegated permissions | Role = Application permissions
                $resourceAccess.Id = $exposedPermission.Id # Read directory data
                $requiredAccess.ResourceAccess += $resourceAccess
                }
        }
    }
}

#
# Example: GetRequiredPermissions "Microsoft Graph"  "Graph.Read|User.Read"
# See also: http://stackoverflow.com/questions/42164581/how-to-configure-a-new-azure-ad-application-through-powershell
Function GetRequiredPermissions([string] $applicationDisplayName, [string] $requiredDelegatedPermissions, [string]$requiredApplicationPermissions, $servicePrincipal)
{
    # If we are passed the service principal we use it directly, otherwise we find it from the display name (which might not be unique)
    if ($servicePrincipal)
    {
        $sp = $servicePrincipal
    }
    else
    {
        $sp = Get-MgServicePrincipal -Filter "DisplayName eq '$applicationDisplayName'"
    }
    $appid = $sp.AppId
    $requiredAccess = New-Object Microsoft.Graph.PowerShell.Models.MicrosoftGraphRequiredResourceAccess
    $requiredAccess.ResourceAppId = $appid 
    $requiredAccess.ResourceAccess = New-Object System.Collections.Generic.List[Microsoft.Graph.PowerShell.Models.MicrosoftGraphResourceAccess]

    # $sp.Oauth2Permissions | Select Id,AdminConsentDisplayName,Value: To see the list of all the Delegated permissions for the application:
    if ($requiredDelegatedPermissions)
    {
        AddResourcePermission $requiredAccess -exposedPermissions $sp.Oauth2PermissionScopes -requiredAccesses $requiredDelegatedPermissions -permissionType "Scope"
    }
    
    # $sp.AppRoles | Select Id,AdminConsentDisplayName,Value: To see the list of all the Application permissions for the application
    if ($requiredApplicationPermissions)
    {
        AddResourcePermission $requiredAccess -exposedPermissions $sp.AppRoles -requiredAccesses $requiredApplicationPermissions -permissionType "Role"
    }
    return $requiredAccess
}


<#.Description
   This function takes a string input as a single line, matches a key value and replaces with the replacement value
#> 
Function UpdateLine([string] $line, [string] $value)
{
    $index = $line.IndexOf(':')
    $lineEnd = ''

    if($line[$line.Length - 1] -eq ','){   $lineEnd = ',' }
    
    if ($index -ige 0)
    {
        $line = $line.Substring(0, $index+1) + " " + '"' + $value+ '"' + $lineEnd
    }
    return $line
}

<#.Description
   This function takes a dictionary of keys to search and their replacements and replaces the placeholders in a text file
#> 
Function UpdateTextFile([string] $configFilePath, [System.Collections.HashTable] $dictionary)
{
    $lines = Get-Content $configFilePath
    $index = 0
    while($index -lt $lines.Length)
    {
        $line = $lines[$index]
        foreach($key in $dictionary.Keys)
        {
            if ($line.Contains($key))
            {
                $lines[$index] = UpdateLine $line $dictionary[$key]
            }
        }
        $index++
    }

    Set-Content -Path $configFilePath -Value $lines -Force
}

<#.Description
   This function takes a string input as a single line, matches a key value and replaces with the replacement value
#>     
Function ReplaceInLine([string] $line, [string] $key, [string] $value)
{
    $index = $line.IndexOf($key)
    if ($index -ige 0)
    {
        $index2 = $index+$key.Length
        $line = $line.Substring(0, $index) + $value + $line.Substring($index2)
    }
    return $line
}

<#.Description
   This function takes a dictionary of keys to search and their replacements and replaces the placeholders in a text file
#>     
Function ReplaceInTextFile([string] $configFilePath, [System.Collections.HashTable] $dictionary)
{
    $lines = Get-Content $configFilePath
    $index = 0
    while($index -lt $lines.Length)
    {
        $line = $lines[$index]
        foreach($key in $dictionary.Keys)
        {
            if ($line.Contains($key))
            {
                $lines[$index] = ReplaceInLine $line $key $dictionary[$key]
            }
        }
        $index++
    }

    Set-Content -Path $configFilePath -Value $lines -Force
}

<#.Description
   This function creates a new Azure AD scope (OAuth2Permission) with default and provided values
#>  
Function CreateScope( [string] $value, [string] $userConsentDisplayName, [string] $userConsentDescription, [string] $adminConsentDisplayName, [string] $adminConsentDescription)
{
    $scope = New-Object Microsoft.Graph.PowerShell.Models.MicrosoftGraphPermissionScope
    $scope.Id = New-Guid
    $scope.Value = $value
    $scope.UserConsentDisplayName = $userConsentDisplayName
    $scope.UserConsentDescription = $userConsentDescription
    $scope.AdminConsentDisplayName = $adminConsentDisplayName
    $scope.AdminConsentDescription = $adminConsentDescription
    $scope.IsEnabled = $true
    $scope.Type = "User"
    return $scope
}

<#.Description
   This function creates a new Azure AD AppRole with default and provided values
#>  
Function CreateAppRole([string] $types, [string] $name, [string] $description)
{
    $appRole = New-Object Microsoft.Graph.PowerShell.Models.MicrosoftGraphAppRole
    $appRole.AllowedMemberTypes = New-Object System.Collections.Generic.List[string]
    $typesArr = $types.Split(',')
    foreach($type in $typesArr)
    {
        $appRole.AllowedMemberTypes += $type;
    }
    $appRole.DisplayName = $name
    $appRole.Id = New-Guid
    $appRole.IsEnabled = $true
    $appRole.Description = $description
    $appRole.Value = $name;
    return $appRole
}

<#.Description
   This function takes a string as input and creates an instance of an Optional claim object
#> 
Function CreateOptionalClaim([string] $name)
{
    <#.Description
    This function creates a new Azure AD optional claims  with default and provided values
    #>  

    $appClaim = New-Object Microsoft.Graph.PowerShell.Models.MicrosoftGraphOptionalClaim
    $appClaim.AdditionalProperties =  New-Object System.Collections.Generic.List[string]
    $appClaim.Source =  $null
    $appClaim.Essential = $false
    $appClaim.Name = $name
    return $appClaim
}

Function Get-RandomPassword {
    param (
        [Parameter(Mandatory)]
        [ValidateRange(4,[int]::MaxValue)]
        [int] $length,
        [int] $upper = 1,
        [int] $lower = 1,
        [int] $numeric = 1,
        [int] $special = 1
    )
    if($upper + $lower + $numeric + $special -gt $length) {
        throw "number of upper/lower/numeric/special char must be lower or equal to length"
    }
    $uCharSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    $lCharSet = "abcdefghijklmnopqrstuvwxyz"
    $nCharSet = "0123456789"
    $sCharSet = "/*-+,!?=()@;:._"
    $charSet = ""
    if($upper -gt 0) { $charSet += $uCharSet }
    if($lower -gt 0) { $charSet += $lCharSet }
    if($numeric -gt 0) { $charSet += $nCharSet }
    if($special -gt 0) { $charSet += $sCharSet }
    
    $charSet = $charSet.ToCharArray()
    $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
    $bytes = New-Object byte[]($length)
    $rng.GetBytes($bytes)
 
    $result = New-Object char[]($length)
    for ($i = 0 ; $i -lt $length ; $i++) {
        $result[$i] = $charSet[$bytes[$i] % $charSet.Length]
    }
    $password = (-join $result)
    $valid = $true
    if($upper   -gt ($password.ToCharArray() | Where-Object {$_ -cin $uCharSet.ToCharArray() }).Count) { $valid = $false }
    if($lower   -gt ($password.ToCharArray() | Where-Object {$_ -cin $lCharSet.ToCharArray() }).Count) { $valid = $false }
    if($numeric -gt ($password.ToCharArray() | Where-Object {$_ -cin $nCharSet.ToCharArray() }).Count) { $valid = $false }
    if($special -gt ($password.ToCharArray() | Where-Object {$_ -cin $sCharSet.ToCharArray() }).Count) { $valid = $false }
 
    if(!$valid) {
         $password = Get-RandomPassword $length $upper $lower $numeric $special
    }
    return $password
}


<#.Description
   Primary entry method to create and configure app registrations
#> 
Function ConfigureApplications
{
    <#.Description
       This function creates the Azure AD applications for the sample in the provided Azure AD tenant and updates the
       configuration files in the client and service project  of the visual studio solution (App.Config and Web.Config)
       so that they are consistent with the Applications parameters
    #> 
    
    if (!$azureEnvironmentName)
    {
        $azureEnvironmentName = "Global"
    }

    # Connect to the Microsoft Graph API, non-interactive is not supported for the moment (Oct 2021)
    Write-Host "Connecting to Microsoft Graph"
    if ($tenantId -eq "") {
        Connect-MgGraph -Scopes "User.ReadWrite.All Organization.Read.All Application.ReadWrite.All" -Environment $azureEnvironmentName
    }
    else {
        Connect-MgGraph -TenantId $tenantId -Scopes "User.ReadWrite.All Organization.Read.All Application.ReadWrite.All" -Environment $azureEnvironmentName
    }
    
    $context = Get-MgContext
    $tenantId = $context.TenantId

    # Get the user running the script
    $currentUserPrincipalName = $context.Account
    $user = Get-MgUser -Filter "UserPrincipalName eq '$($context.Account)'"

    # get the tenant we signed in to
    $Tenant = Get-MgOrganization
    $tenantName = $Tenant.DisplayName
    
    $verifiedDomain = $Tenant.VerifiedDomains | where {$_.Isdefault -eq $true}
    $verifiedDomainName = $verifiedDomain.Name
    $tenantId = $Tenant.Id

    Write-Host ("Connected to Tenant {0} ({1}) as account '{2}'. Domain is '{3}'" -f  $Tenant.DisplayName, $Tenant.Id, $currentUserPrincipalName, $verifiedDomainName)

   # Create the client AAD application
   Write-Host "Creating the AAD application (express-web-app-perf)"
   # Get a 6 months application key for the client Application
   $fromDate = [DateTime]::Now;
   $key = CreateAppKey -fromDate $fromDate -durationInMonths 6
   
   # create the application 
   $clientAadApplication = New-MgApplication -DisplayName "express-web-app-perf" `
                                                      -Web `
                                                      @{ `
                                                          RedirectUris = "http://localhost:3000/auth/redirect"; `
                                                          HomePageUrl = "http://localhost:3000"; `
                                                        } `
                                                       -SignInAudience AzureADMyOrg `
                                                       -IsFallbackPublicClient `
                                                      #end of command

    #add a secret to the application
    $pwdCredential = Add-MgApplicationPassword -ApplicationId $clientAadApplication.Id -PasswordCredential $key
    $clientAppKey = $pwdCredential.SecretText

    $currentAppId = $clientAadApplication.AppId
    $currentAppObjectId = $clientAadApplication.Id

    $tenantName = (Get-MgApplication -ApplicationId $currentAppObjectId).PublisherDomain
    #Update-MgApplication -ApplicationId $currentAppObjectId -IdentifierUris @("https://$tenantName/express-web-app-perf")
    
    # create the service principal of the newly created application     
    $clientServicePrincipal = New-MgServicePrincipal -AppId $currentAppId -Tags {WindowsAzureActiveDirectoryIntegratedApp}

    # add the user running the script as an app owner if needed
    $owner = Get-MgApplicationOwner -ApplicationId $currentAppObjectId
    if ($owner -eq $null)
    { 
        New-MgApplicationOwnerByRef -ApplicationId $currentAppObjectId  -BodyParameter = @{"@odata.id" = "htps://graph.microsoft.com/v1.0/directoryObjects/$user.ObjectId"}
        Write-Host "'$($user.UserPrincipalName)' added as an application owner to app '$($clientServicePrincipal.DisplayName)'"
    }
    Write-Host "Done creating the client application (express-web-app-perf)"

    # URL of the AAD application in the Azure portal
    # Future? $clientPortalUrl = "https://portal.azure.com/#@"+$tenantName+"/blade/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/Overview/appId/"+$currentAppId+"/objectId/"+$currentAppObjectId+"/isMSAApp/"
    $clientPortalUrl = "https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Overview/appId/"+$currentAppId+"/isMSAApp~/false"

    Add-Content -Value "<tr><td>client</td><td>$currentAppId</td><td><a href='$clientPortalUrl'>express-web-app-perf</a></td></tr>" -Path createdApps.html
    # Declare a list to hold RRA items    
    $requiredResourcesAccess = New-Object System.Collections.Generic.List[Microsoft.Graph.PowerShell.Models.MicrosoftGraphRequiredResourceAccess]

    # Add Required Resources Access (from 'client' to 'Microsoft Graph')
    Write-Host "Getting access from 'client' to 'Microsoft Graph'"
    $requiredPermission = GetRequiredPermissions -applicationDisplayName "Microsoft Graph"`
        -requiredDelegatedPermissions "User.Read"

    $requiredResourcesAccess.Add($requiredPermission)
    Write-Host "Added 'Microsoft Graph' to the RRA list."
    # Useful for RRA additions troubleshooting
    # $requiredResourcesAccess.Count
    # $requiredResourcesAccess
    
    Update-MgApplication -ApplicationId $currentAppObjectId -RequiredResourceAccess $requiredResourcesAccess
    Write-Host "Granted permissions."
    

    # print the registered app portal URL for any further navigation
    Write-Host "Successfully registered and configured that app registration for 'express-web-app-perf' at `n $clientPortalUrl" -ForegroundColor Green 
   # Create the service AAD application
   Write-Host "Creating the AAD application (express-web-api-perf)"
   # Get a 6 months application key for the service Application
   $fromDate = [DateTime]::Now;
   $key = CreateAppKey -fromDate $fromDate -durationInMonths 6
   
   # create the application 
   $serviceAadApplication = New-MgApplication -DisplayName "express-web-api-perf" `
                                                       -Web `
                                                       @{ `
                                                         } `
                                                         -Api `
                                                         @{ `
                                                            RequestedAccessTokenVersion = 2 `
                                                         } `
                                                        -SignInAudience AzureADMyOrg `
                                                       #end of command

    #add a secret to the application
    $pwdCredential = Add-MgApplicationPassword -ApplicationId $serviceAadApplication.Id -PasswordCredential $key
    $serviceAppKey = $pwdCredential.SecretText

    $currentAppId = $serviceAadApplication.AppId
    $currentAppObjectId = $serviceAadApplication.Id

    $serviceIdentifierUri = 'api://'+$currentAppId
    Update-MgApplication -ApplicationId $currentAppObjectId -IdentifierUris @($serviceIdentifierUri)
    
    # create the service principal of the newly created application     
    $serviceServicePrincipal = New-MgServicePrincipal -AppId $currentAppId -Tags {WindowsAzureActiveDirectoryIntegratedApp}

    # add the user running the script as an app owner if needed
    $owner = Get-MgApplicationOwner -ApplicationId $currentAppObjectId
    if ($owner -eq $null)
    { 
        New-MgApplicationOwnerByRef -ApplicationId $currentAppObjectId  -BodyParameter = @{"@odata.id" = "htps://graph.microsoft.com/v1.0/directoryObjects/$user.ObjectId"}
        Write-Host "'$($user.UserPrincipalName)' added as an application owner to app '$($serviceServicePrincipal.DisplayName)'"
    }

    # Add Claims

    $optionalClaims = New-Object Microsoft.Graph.PowerShell.Models.MicrosoftGraphOptionalClaims
    $optionalClaims.AccessToken = New-Object System.Collections.Generic.List[Microsoft.Graph.PowerShell.Models.MicrosoftGraphOptionalClaim]
    $optionalClaims.IdToken = New-Object System.Collections.Generic.List[Microsoft.Graph.PowerShell.Models.MicrosoftGraphOptionalClaim]
    $optionalClaims.Saml2Token = New-Object System.Collections.Generic.List[Microsoft.Graph.PowerShell.Models.MicrosoftGraphOptionalClaim]

    # Add Optional Claims

    $newClaim =  CreateOptionalClaim  -name "idtyp" 
    $optionalClaims.AccessToken += ($newClaim)
    Update-MgApplication -ApplicationId $currentAppObjectId -OptionalClaims $optionalClaims
    
    # rename the user_impersonation scope if it exists to match the readme steps or add a new scope
       
    # delete default scope i.e. User_impersonation
    $scopes = New-Object System.Collections.Generic.List[Microsoft.Graph.PowerShell.Models.MicrosoftGraphPermissionScope]
    $scope = $serviceAadApplication.Api.Oauth2PermissionScopes | Where-Object { $_.Value -eq "User_impersonation" }
    
    if($scope -ne $null)
    {    
        # disable the scope
        $scope.IsEnabled = $false
        $scopes.Add($scope)
        Update-MgApplication -ApplicationId $currentAppObjectId -Api @{Oauth2PermissionScopes = @($scopes)}

        # clear the scope
        Update-MgApplication -ApplicationId $currentAppObjectId -Api @{Oauth2PermissionScopes = @()}
    }

    $scopes = New-Object System.Collections.Generic.List[Microsoft.Graph.PowerShell.Models.MicrosoftGraphPermissionScope]
    $scope = CreateScope -value access_as_user  `
        -userConsentDisplayName "access_as_user"  `
        -userConsentDescription "eg. Allows the app to read your files."  `
        -adminConsentDisplayName "access_as_user"  `
        -adminConsentDescription "e.g. Allows the app to read the signed-in user's files."
            
    $scopes.Add($scope)
    
    # add/update scopes
    Update-MgApplication -ApplicationId $currentAppObjectId -Api @{Oauth2PermissionScopes = @($scopes)}
    Update-MgApplication -ApplicationId $currentAppObjectId -Api @{PreAuthorizedApplications = @{AppId = $clientAadApplication.AppId; DelegatedPermissionIds = @($scope.Id)}}
    Write-Host "Done creating the service application (express-web-api-perf)"

    # URL of the AAD application in the Azure portal
    # Future? $servicePortalUrl = "https://portal.azure.com/#@"+$tenantName+"/blade/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/Overview/appId/"+$currentAppId+"/objectId/"+$currentAppObjectId+"/isMSAApp/"
    $servicePortalUrl = "https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Overview/appId/"+$currentAppId+"/isMSAApp~/false"

    Add-Content -Value "<tr><td>service</td><td>$currentAppId</td><td><a href='$servicePortalUrl'>express-web-api-perf</a></td></tr>" -Path createdApps.html
    # Declare a list to hold RRA items    
    $requiredResourcesAccess = New-Object System.Collections.Generic.List[Microsoft.Graph.PowerShell.Models.MicrosoftGraphRequiredResourceAccess]

    # Add Required Resources Access (from 'service' to 'Microsoft Graph')
    Write-Host "Getting access from 'service' to 'Microsoft Graph'"
    $requiredPermission = GetRequiredPermissions -applicationDisplayName "Microsoft Graph"`
        -requiredDelegatedPermissions "User.Read|offline_access"

    $requiredResourcesAccess.Add($requiredPermission)
    Write-Host "Added 'Microsoft Graph' to the RRA list."
    # Useful for RRA additions troubleshooting
    # $requiredResourcesAccess.Count
    # $requiredResourcesAccess
    
    Update-MgApplication -ApplicationId $currentAppObjectId -RequiredResourceAccess $requiredResourcesAccess
    Write-Host "Granted permissions."
    

    # print the registered app portal URL for any further navigation
    Write-Host "Successfully registered and configured that app registration for 'express-web-api-perf' at `n $servicePortalUrl" -ForegroundColor Green 
    
    $displayName =  "perf-test-user"
    $userEmail = $displayName + "@" + $tenantName 
    $password =  Get-RandomPassword 8

    $PasswordProfile = @{
        Password =  $password
    }

    $user =  Get-MgUser -Filter "UserPrincipalName eq '$($userEmail)'" 

    if(!$user)
    {
        $user = New-MgUser -DisplayName $displayName -PasswordProfile $PasswordProfile -AccountEnabled -MailNickName $nickName -UserPrincipalName $userEmail
        Write-Host "Email: is "($user.UserPrincipalName)" and password is $password"
    }
    else
    {
        Write-Host "Email: "($user.UserPrincipalName)" already exists"
    }

    return $user


    # Update config file for 'service'
    # $configFile = $pwd.Path + "\..\web-api\.env"
    $configFile = $(Resolve-Path ($pwd.Path + "\..\web-api\.env"))
    
    $dictionary = @{ "Enter_the_Application_Id_Here" = $serviceAadApplication.AppId;"Enter_the_Tenant_Info_Here" = $tenantId;"Enter_the_Client_Secret_Here" = $serviceAppKey;"Enter_the_Application_Id_Calling_App_Here" = $clientAadApplication.AppId;"Enter_the_Test_User_Username_Here" = $userEmail ;"Enter_the_Test_User_Password_Here" = $password };

    Write-Host "Updating the sample config '$configFile' with the following config values:" -ForegroundColor Yellow 
    $dictionary
    Write-Host "-----------------"

    ReplaceInTextFile -configFilePath $configFile -dictionary $dictionary
    
    # Update config file for 'client'
    # $configFile = $pwd.Path + "\..\web-app\.env"
    $configFile = $(Resolve-Path ($pwd.Path + "\..\web-app\.env"))
    
    $dictionary = @{ "Enter_the_Application_Id_Here" = $clientAadApplication.AppId;"Enter_the_Tenant_Info_Here" = $tenantId;"Enter_the_Client_Secret_Here" = $clientAppKey;"Enter_the_Test_User_Username_Here" = $userEmail;"Enter_the_Test_User_Password_Here" = $password };

    Write-Host "Updating the sample config '$configFile' with the following config values:" -ForegroundColor Yellow 
    $dictionary
    Write-Host "-----------------"

    ReplaceInTextFile -configFilePath $configFile -dictionary $dictionary
    Write-Host "- App client  - created at $clientPortalUrl"

    Write-Host "- App service  - created at $servicePortalUrl"


Add-Content -Value "</tbody></table></body></html>" -Path createdApps.html  
} # end of ConfigureApplications function

# Pre-requisites

if ($null -eq (Get-Module -ListAvailable -Name "Microsoft.Graph")) {
    Install-Module "Microsoft.Graph" -Scope CurrentUser 
}

#Import-Module Microsoft.Graph

if ($null -eq (Get-Module -ListAvailable -Name "Microsoft.Graph.Authentication")) {
    Install-Module "Microsoft.Graph.Authentication" -Scope CurrentUser 
}

Import-Module Microsoft.Graph.Authentication

if ($null -eq (Get-Module -ListAvailable -Name "Microsoft.Graph.Identity.DirectoryManagement")) {
    Install-Module "Microsoft.Graph.Identity.DirectoryManagement" -Scope CurrentUser 
}

Import-Module Microsoft.Graph.Identity.DirectoryManagement

if ($null -eq (Get-Module -ListAvailable -Name "Microsoft.Graph.Applications")) {
    Install-Module "Microsoft.Graph.Applications" -Scope CurrentUser 
}

Import-Module Microsoft.Graph.Applications

if ($null -eq (Get-Module -ListAvailable -Name "Microsoft.Graph.Groups")) {
    Install-Module "Microsoft.Graph.Groups" -Scope CurrentUser 
}

Import-Module Microsoft.Graph.Groups

if ($null -eq (Get-Module -ListAvailable -Name "Microsoft.Graph.Users")) {
    Install-Module "Microsoft.Graph.Users" -Scope CurrentUser 
}

Import-Module Microsoft.Graph.Users

Set-Content -Value "<html><body><table>" -Path createdApps.html
Add-Content -Value "<thead><tr><th>Application</th><th>AppId</th><th>Url in the Azure portal</th></tr></thead><tbody>" -Path createdApps.html

$ErrorActionPreference = "Stop"

# Run interactively (will ask you for the tenant ID)

try
{
    ConfigureApplications -tenantId $tenantId -environment $azureEnvironmentName
}
catch
{
    $_.Exception.ToString() | out-host
    $message = $_
    Write-Warning $Error[0]    
    Write-Host "Unable to register apps. Error is $message." -ForegroundColor White -BackgroundColor Red
}
Write-Host "Disconnecting from tenant"
Disconnect-MgGraph