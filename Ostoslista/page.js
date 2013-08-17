
var ostoslistaState = { userName: '', userId: '', accessToken: '', friends: null, waitingForFriends: false };
var progressState = { timer: null };

if (typeof String.prototype.startsWith != 'function') {
    String.prototype.startsWith = function (str) {
        return this.slice(0, str.length).toUpperCase() == str.toUpperCase();
    };
}

var client = new WindowsAzure.MobileServiceClient('https://ostoslista.azure-mobile.net/', 'wFWmmDhjlWzQVQzuFTxIxRTKhdBrSx70'),
    todoItemTable = client.getTable('todoitem'),
    listTable = client.getTable('list'),
    listPermissionTable = client.getTable('listpermission');

function refreshLists(callback) {
    var query = listPermissionTable.where({ userId: ostoslistaState.userId });
    initProgressIndicator();
    query.read().then(function (listPermissionItems) {
        if (listPermissionItems.length == 0) {
            listPermissionTable.insert({ listName: "OLETUS", userName: ostoslistaState.userName, listId: guid() }).then(refreshLists, handleError);
            return;
        }

        var options = $('#lists');
        $.each(listPermissionItems, function () {
            options.append($("<option />").val(this.listId).text(this.listName));
        });

        typeof callback === 'function' && callback();

        refreshTodoItems();
        refreshSharedFriends();
        cancelProgressIndicator();
    }, handleError);
}

function guid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Read current data and rebuild UI.
// If you plan to generate complex UIs like this, consider using a JavaScript templating library.
function refreshTodoItems(callback) {
    var listId = $('#lists option:selected').val();

    // listId is needed both for where and read. In where it filters the results, in read it is used for checking permissions.
    var query = todoItemTable.where({ listId: listId });

    query.read({ listId: listId }).then(function (todoItems) {
        var listItems = $.map(todoItems, function (item) {
            return $('<li>')
                .attr('data-todoitem-id', item.id)
                .append($('<button class="item-delete">Poista</button>'))
                .append($('<input type="checkbox" class="item-complete">').prop('checked', item.complete))
                .append($('<div>').append($('<input class="item-text">').val(item.text)));
        });

        $('#todo-items').empty().append(listItems).toggle(listItems.length > 0);
        $('#summary').html('<strong>' + todoItems.length + '</strong> asiaa listalla');
        typeof callback === 'function' && callback();
    }, handleError);
}

function refreshSharedFriends() {
    var listId = $('#lists option:selected').val();
    var query = listPermissionTable.where({ listId: listId });
    var sharedFriends = $('#shared-friends');

    query.read().then(function (listPermissions) {
        ostoslistaState.listPermissions = listPermissions;

        if (listPermissions.length > 1) {
            sharedFriends.empty().show();
            sharedFriends.text('Jaettu seuraavien ystävien kanssa: ');

            for (var i = 0; i < listPermissions.length; i++) {
                var friendId = listPermissions[i].userId;

                if (friendId !== ostoslistaState.userId) {
                    var friendName = listPermissions[i].userName;
                    var permissionId = listPermissions[i].id;

                    var friendElement = $('<div id="friend-frame">')
                        .append($('<div id="namediv">' + friendName + '</div>'))
                        .append($('<div id="xdiv">').attr('data-permission-id', permissionId).text('x'));

                    sharedFriends.append(friendElement);
                }
            }
        } else {
            sharedFriends.empty().hide();
        }
    });
}

function handleError(error) {
    var text = error + (error.request ? ' - ' + error.request.status : '');
    $('#errorlog').append($('<li>').text(text));
}

function getTodoItemId(formElement) {
    return Number($(formElement).closest('li').attr('data-todoitem-id'));
}

function checkForFriends(isNewKeypress) {
    if (ostoslistaState.friends) {
        buildFriendsPopup();
    } else if (!ostoslistaState.waitingForFriends || !isNewKeypress) {
        ostoslistaState.waitingForFriends = true;
        setTimeout(checkForFriends, 100);
    }
}

function buildFriendsPopup() {
    var friendsToShow = new Array();
    var prefix = $('#new-friend-name').val();

    for (var i = 0; i < ostoslistaState.friends.length && friendsToShow.length < 5; i++) {
        var friend = ostoslistaState.friends[i];

        if (friend.firstName.startsWith(prefix) || friend.lastName.startsWith(prefix)) {
            friendsToShow.push(friend);
        }
    }

    if (friendsToShow.length > 0) {
        var items = $.map(friendsToShow, function (item) {
            return $('<div id="rowdiv">')
                .attr('data-friend-id', item.id)
                .append($('<div id="imgdiv"><img src="http://graph.facebook.com/' + item.id + '/picture" width="50" height="50"></div>'))
                .append($('<div id="namediv">' + item.name + '</div>'));
        });

        $('#friends-popup').empty().append(items).show();
    }
}

function processFriendsData(data) {
    data.sort(function (a, b) {
        if (a.name > b.name) return 1;
        else if (a.name < b.name) return -1;
        return 0;
    });

    ostoslistaState.friends = $.map(data, function (item) {
        var splitName = item.name.split(' ');
        return { id: item.id, name: item.name, firstName: splitName[0], lastName: splitName[1] };
    });
}

function refreshAuthDisplay() {
    var isLoggedIn = client.currentUser !== null;
    $("#logged-in").toggle(isLoggedIn);
    $("#logged-out").toggle(!isLoggedIn);

    if (isLoggedIn) {
        initProgressIndicator();
        FB.api('/me?access_token=' + ostoslistaState.accessToken, function (response) {
            cancelProgressIndicator();
            ostoslistaState.userId = "Facebook:" + response.id;
            ostoslistaState.userName = response.name;
            $("#login-name").text(response.name);
            refreshLists();
            $('input, button, div#xdiv').not('#log-in').removeAttr('disabled').removeClass('disabled-ui');
        });
    } else {
        $('input, button, div#xdiv').not('#log-in').attr('disabled', 'disabled').addClass('disabled-ui');
    }
}

function logIn() {
    window.location.replace('https://www.facebook.com/dialog/oauth?client_id=307252376076816&redirect_uri=http%3A%2F%2Fostoslista.azurewebsites.net/index.html&response_type=token')
}

function handleLoginResponse() {
    var frag = $.deparam.fragment();
    if (frag.hasOwnProperty("access_token")) {
        client.invokeApi("getfbaccesstoken", {
            body: null,
            method: "post",
            parameters: { accessToken: frag.access_token }
        }).done(function (results) {
            var responseString = results.response;
            var responseJson = JSON.parse(responseString);
            localStorage.accessToken = responseJson.accessToken;
            window.location.replace('index.html');
        }, handleError);
    } else if (localStorage.accessToken) {
        ostoslistaState.accessToken = localStorage.accessToken;
        initProgressIndicator();
        client.login("facebook", { access_token: ostoslistaState.accessToken }).then(function () {
            refreshAuthDisplay();
        }, function (error) {
            alert(error);
        });
    }
}

function logOut() {
    client.logout();
    $('#lists').empty();
    refreshAuthDisplay();
    $('#summary').html('<strong>Kirjaudu sisään, jotta voit käyttää ostoslistoja.</strong>');
    closeAllPanels();
}

function initProgressIndicator() {
    progressState.timer = setTimeout(showProgressIndicator, 200);
}

function showProgressIndicator() {
    $('#progress').slideDown(100);
}

function cancelProgressIndicator() {
    if (progressState.timer) {
        clearTimeout(progressState.timer);
        progressState.timer = null;
    }

    $('#progress').slideUp(100);
}

function openAddListPanel() {
    $('#add-list-panel').show();
    $('#new-list-name').focus();
}

function closeAddListPanel() {
    $('#add-list-panel').hide();
}

function openAddFriendPanel() {
    $('#add-friend-panel').show();
    $('#new-friend-name').focus();
    if (!ostoslistaState.friends) {
        FB.api('/me/friends?fields=id,name&access_token=' + ostoslistaState.accessToken, function (response) {
            processFriendsData(response.data);
        });
    }
}

function closeAddFriendPanel(evt) {
    $('#new-friend-name').val('');
    $('#add-friend-panel').hide();
    if (evt) {
        evt.preventDefault();
    }
}

function hideFriendsPopup() {
    $('friends-popup').empty().hide();
}

function closeAllPanels() {
    closeAddListPanel();
    closeAddFriendPanel();
    hideFriendsPopup();
}

$(function () {

    // Handle inserting new item
    $('#add-item').submit(function(evt) {
        var textbox = $('#new-item-text'),
            itemText = textbox.val(),
            listId = $('#lists option:selected').val();

        if (itemText !== '') {
            initProgressIndicator();
            todoItemTable.insert({ text: itemText, complete: false, listId: listId }).then(function () {
                refreshTodoItems(function () { cancelProgressIndicator() });
            }, handleError);
        }

        textbox.val('').focus();
        evt.preventDefault();
    });

    // Handle inserting new list
    $('#add-list').submit(function (evt) {
        var textbox = $('#new-list-name'),
            itemText = textbox.val(),
            listId = $('#lists option:selected').val();
        if (itemText !== '') {
            var newGuid = guid();
            listPermissionTable.insert({ listName: itemText, userName: ostoslistaState.userName, listId: newGuid }).then(function () {
                refreshLists(function () {
                    closeAddListPanel();
                    $('#lists').val(newGuid);
                });
            }, handleError);
        }
        textbox.val('');
        evt.preventDefault();
    });

    $('#lists').change(function (evt) {
        initProgressIndicator();
        refreshTodoItems();
        refreshSharedFriends();
        cancelProgressIndicator();
        evt.preventDefault();
    });

    // Handle update
    $(document.body).on('change', '.item-text', function() {
        var newText = $(this).val();
        todoItemTable.update({ id: getTodoItemId(this), text: newText }).then(null, handleError);
    });

    $(document.body).on('change', '.item-complete', function() {
        var isComplete = $(this).prop('checked');
        todoItemTable.update({ id: getTodoItemId(this), complete: isComplete }).then(refreshTodoItems, handleError);
    });

    // Handle delete
    $(document.body).on('click', '.item-delete', function () {
        todoItemTable.del({ id: getTodoItemId(this) }).then(refreshTodoItems, handleError);
    });

    $('#friends-popup').on('click', 'div#rowdiv', function () {
        var id = $(this).attr('data-friend-id');
        var friendsArray = ostoslistaState.friends;
        var friendName;

        for (var i = 0; i < friendsArray.length; i++) {
            if (friendsArray[i].id === id) {
                friendName = friendsArray[i].name;
                break;
            }
        }

        var listId = $('#lists option:selected').val();
        var listName = $('#lists option:selected').text();

        listPermissionTable.insert({
            listName: listName,
            userId: 'Facebook:' + id,
            userName: friendName,
            listId: listId
        }).then(refreshSharedFriends, handleError);
    });

    $('#shared-friends').on('click', 'div#xdiv', function () {
        var id = $(this).attr('data-permission-id');

        initProgressIndicator();
        listPermissionTable.del({
            id: id
        }).then(function () {
            refreshSharedFriends();
            cancelProgressIndicator();
        }, handleError);
    });

    $('#new-friend-name').keyup(function () {
        if ($('#new-friend-name').val().length > 0) {
            checkForFriends(true);
        } else {
            hideFriendsPopup();
        }
    });

    $('#new-friend-name').keydown(function (e) {
        if (e.which === 27) {
            e.preventDefault();
            e.stopPropagation();
            closeAddFriendPanel();
        }
    });

    $('#new-list-name').keydown(function (e) {
        if (e.which === 27) {
            e.preventDefault();
            e.stopPropagation();
            closeAddListPanel();
        }
    });
    
    // On page init, fetch the data and set up event handlers
    $(function () {
        closeAllPanels();
        handleLoginResponse();
        refreshAuthDisplay();
        $('#summary').html('<strong>Kirjaudu sisään, jotta voit käyttää ostoslistoja.</strong>');
        $("#logged-out button").click(logIn);
        $("#logged-in button").click(logOut);
        $("#change-list button#add-new-list").click(openAddListPanel);
        $("#change-list button#cancel-add-list").click(closeAddListPanel);
        $("button#share-list, button#share-list-mobile").click(openAddFriendPanel);
        $("button#cancel-add-friend").click(closeAddFriendPanel);
    });
});
