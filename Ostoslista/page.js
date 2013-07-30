
var ostoslistaState = { userName: '', accessToken: '' };

$(function () {

    var client = new WindowsAzure.MobileServiceClient('https://ostoslista.azure-mobile.net/', 'wFWmmDhjlWzQVQzuFTxIxRTKhdBrSx70'),
        todoItemTable = client.getTable('todoitem'),
        listTable = client.getTable('list'),
        listPermissionTable = client.getTable('listpermission');
        
    function refreshLists(callback) {
        var query = listPermissionTable.where({});
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
        }, handleError);
    }

    function guid()
    {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Read current data and rebuild UI.
    // If you plan to generate complex UIs like this, consider using a JavaScript templating library.
    function refreshTodoItems() {
        var listId = $('#lists option:selected').val();

        // listId is needed both for where and read. In where it filters the results, in read it is used for checking permissions.
        var query = todoItemTable.where({ complete: false, listId: listId });

        query.read({ listId: listId }).then(function(todoItems) {
            var listItems = $.map(todoItems, function(item) {
                return $('<li>')
                    .attr('data-todoitem-id', item.id)
                    .append($('<button class="item-delete">Poista</button>'))
                    .append($('<input type="checkbox" class="item-complete">').prop('checked', item.complete))
                    .append($('<div>').append($('<input class="item-text">').val(item.text)));
            });

            $('#todo-items').empty().append(listItems).toggle(listItems.length > 0);
            $('#summary').html('<strong>' + todoItems.length + '</strong> asiaa listalla');
        }, handleError);
    }

    function handleError(error) {
        var text = error + (error.request ? ' - ' + error.request.status : '');
        $('#errorlog').append($('<li>').text(text));
    }

    function getTodoItemId(formElement) {
        return Number($(formElement).closest('li').attr('data-todoitem-id'));
    }

    // Handle inserting new item
    $('#add-item').submit(function(evt) {
        var textbox = $('#new-item-text'),
            itemText = textbox.val(),
            listId = $('#lists option:selected').val();
        if (itemText !== '') {
            todoItemTable.insert({ text: itemText, complete: false, listId: listId }).then(refreshTodoItems, handleError);
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
        refreshTodoItems();
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

    function refreshAuthDisplay() {
        var isLoggedIn = client.currentUser !== null;
        $("#logged-in").toggle(isLoggedIn);
        $("#logged-out").toggle(!isLoggedIn);

        if (isLoggedIn) {
            client.invokeApi("getfbaccesstoken", {
                body: null,
                method: "post"
            }).done(function (results) {
                var responseString = results.response;
                var responseJson = JSON.parse(responseString);
                ostoslistaState.accessToken = responseJson.accessToken;
                FB.api('/me?access_token=' + responseJson.accessToken, function (response) {
                    ostoslistaState.userName = response.name;
                    $("#login-name").text(response.name);
                    refreshLists();
                    var otherbuttons = $('input, button').not('#log-in');
                    otherbuttons.removeAttr('disabled');
                });
            }, handleError);
        }
        else
        {
            var otherbuttons = $('input, button').not('#log-in');
            otherbuttons.attr('disabled', 'disabled');
        }
    }

    function logIn() {
        client.login("facebook").then(refreshAuthDisplay, function (error) {
            alert(error);
        });
    }

    function logOut() {
        client.logout();
        $('#lists').empty();
        refreshAuthDisplay();
        $('#summary').html('<strong>Kirjaudu sisään, jotta voit käyttää ostoslistoja.</strong>');
    }

    function openAddListPanel() {
        $('#add-list-panel').show();
        $('#new-list-name').focus();
    }

    function closeAddListPanel() {
        $('#add-list-panel').hide();
    }

    // On page init, fetch the data and set up event handlers
    $(function () {
        closeAddListPanel();
        refreshAuthDisplay();
        $('#summary').html('<strong>Kirjaudu sisään, jotta voit käyttää ostoslistoja.</strong>');
        $("#logged-out button").click(logIn);
        $("#logged-in button").click(logOut);
        $("#change-list button#add-new-list").click(openAddListPanel);
        $("#change-list button#cancel-add-list").click(closeAddListPanel);
    });
});
